import type {
  ApiResponse,
  DataPointSource,
  Device,
  DevicesPage,
  Duration,
  DurationEvent,
  DurationNavigation,
  DurationPeriod,
  Operator,
} from './types';

const BASE_URL = 'https://connector.iosense.io/api';

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function bearerValue(authentication?: string): string {
  const raw = authentication ?? localStorage.getItem('bearer_token') ?? '';
  return raw.startsWith('Bearer ') ? raw : `Bearer ${raw}`;
}

function getOrg(): string {
  return localStorage.getItem('organisation') ?? 'https://iosense.io';
}

function authHeaders(authentication?: string): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: bearerValue(authentication),
  };
}

function authHeadersWithOrg(authentication?: string): HeadersInit {
  return {
    ...authHeaders(authentication),
    organisation: getOrg(),
    'ngsw-bypass': 'true',
  };
}

// ─── SSO ──────────────────────────────────────────────────────────────────────

interface SSOResponse {
  success: boolean;
  token: string;
  organisation: string;
  userId: string;
}

export async function validateSSOToken(ssoToken: string): Promise<string> {
  const res = await fetch(
    `${BASE_URL}/retrieve-sso-token/${encodeURIComponent(ssoToken)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        organisation: 'https://iosense.io',
        'ngsw-bypass': 'true',
      },
    }
  );
  if (!res.ok) throw new Error(`validateSSOToken failed: ${res.status}`);
  const json: SSOResponse = await res.json();
  if (!json.success) throw new Error('validateSSOToken: success=false');
  localStorage.setItem('bearer_token', json.token);
  localStorage.setItem('organisation', json.organisation);
  return json.token;
}

// ─── Devices ──────────────────────────────────────────────────────────────────

export async function findUserDevices(
  authentication: string | undefined,
  search = '',
  page = 1,
  limit = 50
): Promise<Device[]> {
  const body: Record<string, unknown> = {
    order: 'default',
    sort: 'AtoZ',
    filter: [],
    search: search ? { all: [search] } : {},
  };
  const res = await fetch(`${BASE_URL}/account/devices/${page}/${limit}`, {
    method: 'PUT',
    headers: authHeadersWithOrg(authentication),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`findUserDevices failed: ${res.status}`);
  const json: ApiResponse<DevicesPage> = await res.json();
  if (!json.success) throw new Error('findUserDevices: success=false');
  // NOTE: response nests at data.data
  return json.data.data;
}

export async function getDeviceSpecificMetadata(
  authentication: string | undefined,
  devID: string
): Promise<Device | null> {
  const res = await fetch(
    `${BASE_URL}/account/ai-sdk/metaData/device/${encodeURIComponent(devID)}`,
    {
      method: 'GET',
      headers: { ...authHeaders(authentication), Accept: 'application/json' },
    }
  );
  if (!res.ok) throw new Error(`getDeviceSpecificMetadata failed: ${res.status}`);
  const json: ApiResponse<Device> = await res.json();
  if (!json.success) throw new Error('getDeviceSpecificMetadata: success=false');
  return json.data ?? null;
}

// ─── getWidgetData (pieChart aggregation) ─────────────────────────────────────

interface GetWidgetDataParams {
  authentication: string | undefined;
  source: DataPointSource;
  startTime: number;
  endTime: number;
  timezone: string;
}

function buildConfigItem(source: DataPointSource): Record<string, unknown> | null {
  if (source.sourceType === 'device') {
    if (!source.devID || !source.sensorId || !source.operator) return null;
    return {
      type: 'device',
      devID: source.devID,
      sensor: source.sensorId,
      operator: source.operator,
      key: `${source.devID}_${source.sensorId}`,
    };
  }
  if (source.sourceType === 'cluster') {
    if (!source.clusterID || !source.clusterOperator) return null;
    return {
      type: 'cluster',
      clusterID: source.clusterID,
      operator: source.clusterOperator,
      timeOperator: source.clusterTimeOperator ?? 'sum',
      key: `cluster_${source.clusterID}`,
    };
  }
  if (source.sourceType === 'compute') {
    if (!source.flowId) return null;
    return {
      type: 'compute',
      flowId: source.flowId,
      flowParams: source.flowParameters ?? '',
      key: `compute_${source.flowId}`,
    };
  }
  return null;
}

/**
 * Calls getWidgetData with type="pieChart" — returns the aggregated single
 * value for the configured source (device / cluster / compute).
 */
export async function getDataPointValue(
  params: GetWidgetDataParams
): Promise<number | null> {
  const { authentication, source, startTime, endTime, timezone } = params;

  const configItem = buildConfigItem(source);
  if (!configItem) return null;

  const body = {
    startTime,
    endTime,
    timezone,
    timeBucket: ['year', 'month', 'day', 'hour'],
    timeFrame: 'day',
    type: 'pieChart',
    cycleTime: '00:00',
    config: [configItem],
  };

  const res = await fetch(
    `${BASE_URL}/account/ioLensWidget/getWidgetData`,
    {
      method: 'PUT',
      headers: authHeaders(authentication),
      body: JSON.stringify(body),
    }
  );
  if (!res.ok) throw new Error(`getWidgetData failed: ${res.status}`);

  const json = await res.json();
  if (!json.success) throw new Error('getWidgetData: success=false');

  // Recursively walk the response and return the first entry that has a
  // numeric `data` field. Handles all shapes: array, nested timeFrame/bucket
  // objects, or a single flat entry like { type, devID, sensor, data }.
  function findFirstDataValue(node: unknown): number | null {
    if (node === null || node === undefined) return null;

    if (Array.isArray(node)) {
      for (const item of node) {
        const v = findFirstDataValue(item);
        if (v !== null) return v;
      }
      return null;
    }

    if (typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      if ('data' in obj) {
        const d = obj.data;
        if (typeof d === 'number') return d;
        if (typeof d === 'string') {
          const n = parseFloat(d);
          if (!Number.isNaN(n)) return n;
        }
        // If `data` is a container, descend into it
        if (d && typeof d === 'object') {
          const v = findFirstDataValue(d);
          if (v !== null) return v;
        }
      }
      for (const key of Object.keys(obj)) {
        if (key === 'data') continue;
        const v = findFirstDataValue(obj[key]);
        if (v !== null) return v;
      }
    }
    return null;
  }

  return findFirstDataValue(json.data);
}

// ─── Duration resolver ────────────────────────────────────────────────────────

function resolveEvent(
  ref: Date,
  n: number,
  period: DurationPeriod,
  event: DurationEvent,
  navigation: DurationNavigation,
): number {
  const dir = navigation === 'previous' ? -1 : 1;
  const anchor = new Date(ref);

  switch (period) {
    case 'hour':  anchor.setHours(anchor.getHours() + dir * n); break;
    case 'day':   anchor.setDate(anchor.getDate() + dir * n); break;
    case 'week':  anchor.setDate(anchor.getDate() + dir * n * 7); break;
    case 'month': anchor.setMonth(anchor.getMonth() + dir * n); break;
    case 'year':  anchor.setFullYear(anchor.getFullYear() + dir * n); break;
  }

  if (event === 'now') return anchor.getTime();

  if (event === 'start') {
    switch (period) {
      case 'hour':  anchor.setMinutes(0, 0, 0); break;
      case 'day':   anchor.setHours(0, 0, 0, 0); break;
      case 'week':  anchor.setDate(anchor.getDate() - anchor.getDay()); anchor.setHours(0, 0, 0, 0); break;
      case 'month': anchor.setDate(1); anchor.setHours(0, 0, 0, 0); break;
      case 'year':  anchor.setMonth(0, 1); anchor.setHours(0, 0, 0, 0); break;
    }
    return anchor.getTime();
  }

  // event === 'end'
  switch (period) {
    case 'hour':  anchor.setMinutes(59, 59, 999); break;
    case 'day':   anchor.setHours(23, 59, 59, 999); break;
    case 'week':  anchor.setDate(anchor.getDate() - anchor.getDay() + 6); anchor.setHours(23, 59, 59, 999); break;
    case 'month': anchor.setMonth(anchor.getMonth() + 1, 0); anchor.setHours(23, 59, 59, 999); break;
    case 'year':  anchor.setMonth(11, 31); anchor.setHours(23, 59, 59, 999); break;
  }
  return anchor.getTime();
}

export function resolveDuration(d: Duration): { startTime: number; endTime: number } {
  const now = new Date();
  return {
    startTime: resolveEvent(now, d.xNumber, d.xPeriod, d.xEvent, d.navigation),
    endTime:   resolveEvent(now, d.yNumber, d.yPeriod, d.yEvent, d.navigation),
  };
}
