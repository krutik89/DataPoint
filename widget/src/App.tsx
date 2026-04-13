import React, { useEffect, useRef, useState } from 'react';
import '@faclon-labs/design-sdk/styles.css';
import { validateSSOToken, getDataPointValue, resolveDuration } from './iosense-sdk/api';
import type { WidgetConfig } from './iosense-sdk/types';

// Self-registration side effects
import './components/DataPoint/index';
import './components/DataPointConfiguration/index';

const WIDGET_ID = 'widget-preview';
const CONFIG_ID = 'config-preview';

export default function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [config, setConfig] = useState<WidgetConfig>({});

  // Fetched data state — owned by App for the dev preview
  const [data, setData] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | undefined>(undefined);

  const widgetMounted = useRef(false);
  const configMounted = useRef(false);

  const authentication = localStorage.getItem('bearer_token') ?? '';

  // ── Auth ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');

    if (ssoToken) {
      params.delete('token');
      const newUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', newUrl);

      validateSSOToken(ssoToken)
        .then(() => setAuthenticated(true))
        .catch((err) => setAuthError(err instanceof Error ? err.message : 'Auth failed'));
    } else if (localStorage.getItem('bearer_token')) {
      setAuthenticated(true);
    }
  }, []);

  // ── Data fetch ───────────────────────────────────────────────────────────
  const source = config.source;
  const timezone = config.timezone ?? 'Asia/Calcutta';
  const durations = config.durations ?? [];
  const defaultDuration = durations.find((d) => d.id === config.defaultDurationId);
  const timeRangeHours = config.timeRangeHours ?? 24;

  const sourceReady =
    !!source &&
    ((source.sourceType === 'device' && source.devID && source.sensorId && source.operator) ||
      (source.sourceType === 'cluster' && source.clusterID && source.clusterOperator) ||
      (source.sourceType === 'compute' && source.flowId) ||
      source.sourceType === 'custom');

  useEffect(() => {
    // Custom type: no fetch needed — value comes directly from config
    if (source?.sourceType === 'custom') {
      setData(null);
      setIsLoading(false);
      setFetchError(undefined);
      return;
    }

    if (!authenticated || !source || !sourceReady) {
      setData(null);
      setIsLoading(false);
      setFetchError(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setFetchError(undefined);

    const debounceId = setTimeout(() => {
      const { startTime, endTime } = defaultDuration
        ? resolveDuration(defaultDuration)
        : { startTime: Date.now() - timeRangeHours * 3_600_000, endTime: Date.now() };

      getDataPointValue({ authentication, source, startTime, endTime, timezone })
        .then((v) => {
          if (cancelled) return;
          setData(v);
          setIsLoading(false);
        })
        .catch((err) => {
          if (cancelled) return;
          setFetchError(err instanceof Error ? err.message : 'Failed to fetch');
          setIsLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounceId);
    };
  }, [
    authenticated,
    authentication,
    source?.sourceType,
    source?.devID,
    source?.sensorId,
    source?.operator,
    source?.clusterID,
    source?.clusterOperator,
    source?.clusterTimeOperator,
    source?.flowId,
    source?.flowParameters,
    sourceReady,
    timeRangeHours,
    timezone,
    defaultDuration?.id,
    defaultDuration?.xNumber,
    defaultDuration?.xPeriod,
    defaultDuration?.xEvent,
    defaultDuration?.yNumber,
    defaultDuration?.yPeriod,
    defaultDuration?.yEvent,
    defaultDuration?.navigation,
  ]);

  // ── Mount / update widgets ───────────────────────────────────────────────
  useEffect(() => {
    if (!authenticated) return;

    const widgetProps = { config, data, isLoading, error: fetchError };
    const configProps = {
      config,
      authentication,
      onChange: (next: WidgetConfig) => setConfig(next),
    };

    if (!widgetMounted.current) {
      window.ReactWidgets['DataPoint'].mount(WIDGET_ID, widgetProps);
      widgetMounted.current = true;
    } else {
      window.ReactWidgets['DataPoint'].update(WIDGET_ID, widgetProps);
    }

    if (!configMounted.current) {
      (window.ReactWidgets['DataPointConfiguration'] as any).mount(CONFIG_ID, configProps);
      configMounted.current = true;
    } else {
      (window.ReactWidgets['DataPointConfiguration'] as any).update(CONFIG_ID, configProps);
    }
  }, [authenticated, config, data, isLoading, fetchError, authentication]);

  useEffect(() => {
    return () => {
      if (widgetMounted.current) window.ReactWidgets['DataPoint']?.unmount(WIDGET_ID);
      if (configMounted.current) window.ReactWidgets['DataPointConfiguration']?.unmount(CONFIG_ID);
    };
  }, []);

  if (authError) {
    return (
      <div style={{ padding: 32, color: 'red', fontFamily: 'sans-serif' }}>
        Auth error: {authError}
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div style={{ padding: 32, fontFamily: 'sans-serif' }}>
        <p>Append <code>?token=YOUR_SSO_TOKEN</code> to the URL to authenticate.</p>
        <p>Generate an SSO token from your <strong>IOsense portal → Profile → Generate SSO Token</strong>.</p>
      </div>
    );
  }

  return (
    <div className="app-preview">
      <div className="app-preview__config" id={CONFIG_ID} />
      <div className="app-preview__widget" id={WIDGET_ID} />

      <style>{`
        .app-preview {
          display: flex;
          gap: 24px;
          padding: 24px;
          min-height: 100vh;
          background: var(--background-default-moderate);
          box-sizing: border-box;
        }
        .app-preview__config { flex: 0 0 35%; min-width: 280px; }
        .app-preview__widget { flex: 1; min-width: 0; }
      `}</style>
    </div>
  );
}
