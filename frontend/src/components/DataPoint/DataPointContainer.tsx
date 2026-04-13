'use client';

import { useEffect, useRef, useState } from 'react';
import { getDataPointValue, resolveDuration } from '../../iosense-sdk/api';
import type { WidgetConfig } from '../../iosense-sdk/types';

interface DataPointContainerProps {
  /** DOM element id where the widget will be mounted */
  id: string;
  config?: WidgetConfig;
  authentication: string;
}

export function DataPointContainer({ id, config, authentication }: DataPointContainerProps) {
  const [data, setData] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const mountedRef = useRef(false);

  const source = config?.source;
  const timezone = config?.timezone ?? 'Asia/Calcutta';
  const durations = config?.durations ?? [];
  const defaultDuration = durations.find((d) => d.id === config?.defaultDurationId);
  const timeRangeHours = config?.timeRangeHours ?? 24;

  const sourceReady =
    !!source &&
    ((source.sourceType === 'device' && source.devID && source.sensorId && source.operator) ||
      (source.sourceType === 'cluster' && source.clusterID && source.clusterOperator) ||
      (source.sourceType === 'compute' && source.flowId));

  // ── Fetch data ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!source || !sourceReady) {
      setData(null);
      setIsLoading(false);
      setError(undefined);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(undefined);

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
          setError(err instanceof Error ? err.message : 'Failed to fetch');
          setIsLoading(false);
        });
    }, 400);

    return () => {
      cancelled = true;
      clearTimeout(debounceId);
    };
  }, [
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

  // ── Mount / update widget via global registry ─────────────────────────────
  useEffect(() => {
    const widgets = (window as any).ReactWidgets;
    if (!widgets?.['DataPoint']) return;

    const props = { config, data, isLoading, error };
    if (!mountedRef.current) {
      widgets['DataPoint'].mount(id, props);
      mountedRef.current = true;
    } else {
      widgets['DataPoint'].update(id, props);
    }
  }, [id, config, data, isLoading, error]);

  // ── Unmount on cleanup ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      const widgets = (window as any).ReactWidgets;
      if (mountedRef.current) widgets?.['DataPoint']?.unmount(id);
    };
  }, [id]);

  return <div id={id} />;
}
