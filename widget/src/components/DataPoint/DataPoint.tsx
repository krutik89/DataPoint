import React, { useEffect, useState } from 'react';
import { Card, Spinner } from '@faclon-labs/design-sdk';
import { getDataPointValue, resolveDuration } from '../../iosense-sdk/api';
import type { WidgetConfig } from '../../iosense-sdk/types';
import './DataPoint.css';

interface DataPointProps {
  config?: WidgetConfig;
  authentication: string;
}

type Status = 'idle' | 'loading' | 'success' | 'error' | 'empty';

function formatValue(v: number, precision: number): string {
  return v.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function DataPoint({ config, authentication }: DataPointProps) {
  const [localConfig, setLocalConfig] = useState<WidgetConfig | undefined>(config);
  const [value, setValue] = useState<number | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const source = localConfig?.source;
  const precision = source?.precision ?? 2;
  const unit = localConfig?.unit ?? '';
  const timezone = localConfig?.timezone ?? 'Asia/Calcutta';

  // Resolve time range: prefer the default duration, fallback to timeRangeHours
  const durations = localConfig?.durations ?? [];
  const defaultDuration = durations.find((d) => d.id === localConfig?.defaultDurationId);
  const timeRangeHours = localConfig?.timeRangeHours ?? 24;

  const sourceReady =
    !!source &&
    ((source.sourceType === 'device' && source.devID && source.sensorId && source.operator) ||
      (source.sourceType === 'cluster' && source.clusterID && source.clusterOperator) ||
      (source.sourceType === 'compute' && source.flowId));

  useEffect(() => {
    if (!source || !sourceReady) {
      setStatus('idle');
      setValue(null);
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setErrorMsg('');

    const debounceId = setTimeout(() => {
      const { startTime, endTime } = defaultDuration
        ? resolveDuration(defaultDuration)
        : { startTime: Date.now() - timeRangeHours * 3_600_000, endTime: Date.now() };

      getDataPointValue({
        authentication,
        source,
        startTime,
        endTime,
        timezone,
      })
        .then((v) => {
          if (cancelled) return;
          if (v === null) {
            setValue(null);
            setStatus('empty');
          } else {
            setValue(v);
            setStatus('success');
          }
        })
        .catch((err) => {
          if (cancelled) return;
          setErrorMsg(err instanceof Error ? err.message : 'Failed to fetch');
          setStatus('error');
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

  // Evaluate alert conditions against the current value
  const alerts = localConfig?.alerts ?? [];
  const matchedAlert = value !== null
    ? alerts.find((a) => {
        switch (a.operator) {
          case '>':  return value > a.value;
          case '<':  return value < a.value;
          case '>=': return value >= a.value;
          case '<=': return value <= a.value;
          case '==': return value === a.value;
          case '!=': return value !== a.value;
          default:   return false;
        }
      })
    : undefined;

  const wrapInCard = localConfig?.wrapInCard ?? true;
  const cardStyle: React.CSSProperties = wrapInCard
    ? {
        background: matchedAlert?.backgroundColor || localConfig?.backgroundColor || 'var(--background-default-intense)',
        borderColor: matchedAlert?.borderColor || localConfig?.borderColor || 'var(--border-gray-default)',
        borderWidth: `${localConfig?.borderWidth ?? 1}px`,
        borderStyle: 'solid',
        borderRadius: `${localConfig?.borderRadius ?? 8}px`,
        padding: `${localConfig?.padding ?? 16}px`,
      }
    : { background: 'transparent', border: 'none', padding: 0 };

  const titleStyle: React.CSSProperties = {
    color: matchedAlert?.textColor || localConfig?.titleColor || 'var(--text-default-secondary)',
    fontSize: `${localConfig?.titleFontSize ?? 14}px`,
  };

  const valueStyle: React.CSSProperties = {
    color: matchedAlert?.valueColor || localConfig?.valueColor || 'var(--text-default-primary)',
    fontSize: `${localConfig?.valueFontSize ?? 36}px`,
  };

  const unitStyle: React.CSSProperties = {
    color: matchedAlert?.unitColor || localConfig?.unitColor || 'var(--text-default-tertiary)',
    fontSize: `${localConfig?.unitFontSize ?? 16}px`,
  };

  return (
    <div className="data-point" style={cardStyle}>
      <div className="data-point__title" style={titleStyle}>
        {localConfig?.title ?? 'Data Point'}
      </div>
      {localConfig?.subtitle && (
        <div className="data-point__subtitle">{localConfig.subtitle}</div>
      )}

      <div className="data-point__value-row">
        {status === 'loading' && <Spinner size="Medium" />}
        {status === 'idle' && (
          <span className="data-point__placeholder">Configure a data source</span>
        )}
        {status === 'empty' && (
          <span className="data-point__placeholder">No data</span>
        )}
        {status === 'error' && (
          <span className="data-point__error">Error: {errorMsg}</span>
        )}
        {status === 'success' && value !== null && (
          <>
            <span className="data-point__value" style={valueStyle}>
              {formatValue(value, precision)}
            </span>
            {unit && (
              <span className="data-point__unit" style={unitStyle}>
                {unit}
              </span>
            )}
          </>
        )}
      </div>

    </div>
  );
}
