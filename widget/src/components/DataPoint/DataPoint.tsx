import React from 'react';
import { Spinner } from '@faclon-labs/design-sdk';
import type { WidgetConfig } from '../../iosense-sdk/types';
import './DataPoint.css';

export interface DataPointProps {
  config?: WidgetConfig;
  data: number | null;
  isLoading: boolean;
  error?: string;
}

function formatValue(v: number | null | undefined, precision: number): string {
  if (v === null || v === undefined) return '--';
  return v.toLocaleString(undefined, {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  });
}

export function DataPoint({ config, data, isLoading, error }: DataPointProps) {
  const precision = config?.source?.precision ?? 2;
  const unit = config?.unit ?? '';

  // Evaluate alert conditions against the current value
  const alerts = config?.alerts ?? [];
  const matchedAlert = data !== null
    ? alerts.find((a) => {
        switch (a.operator) {
          case '>':  return data > a.value;
          case '<':  return data < a.value;
          case '>=': return data >= a.value;
          case '<=': return data <= a.value;
          case '==': return data === a.value;
          case '!=': return data !== a.value;
          default:   return false;
        }
      })
    : undefined;

  const wrapInCard = config?.wrapInCard ?? true;
  const cardStyle: React.CSSProperties = wrapInCard
    ? {
        background: matchedAlert?.backgroundColor || config?.backgroundColor || 'var(--background-default-intense)',
        borderColor: matchedAlert?.borderColor || config?.borderColor || 'var(--border-gray-default)',
        borderWidth: `${config?.borderWidth ?? 1}px`,
        borderStyle: 'solid',
        borderRadius: `${config?.borderRadius ?? 8}px`,
        padding: `${config?.padding ?? 16}px`,
      }
    : { background: 'transparent', border: 'none', padding: 0 };

  const titleStyle: React.CSSProperties = {
    color: matchedAlert?.textColor || config?.titleColor || 'var(--text-default-secondary)',
    fontSize: `${config?.titleFontSize ?? 14}px`,
  };

  const valueStyle: React.CSSProperties = {
    color: matchedAlert?.valueColor || config?.valueColor || 'var(--text-default-primary)',
    fontSize: `${config?.valueFontSize ?? 36}px`,
  };

  const unitStyle: React.CSSProperties = {
    color: matchedAlert?.unitColor || config?.unitColor || 'var(--text-default-tertiary)',
    fontSize: `${config?.unitFontSize ?? 16}px`,
  };

  const isEmpty = !isLoading && !error && data === null;
  const isIdle = !isLoading && !error && data === null && !config?.source;

  return (
    <div className="data-point" style={cardStyle}>
      <div className="data-point__title" style={titleStyle}>
        {config?.title ?? 'Data Point'}
      </div>
      {config?.subtitle && (
        <div className="data-point__subtitle">{config.subtitle}</div>
      )}

      <div className="data-point__value-row">
        {isLoading && <Spinner size="Medium" />}
        {!isLoading && isIdle && (
          <span className="data-point__placeholder">Configure a data source</span>
        )}
        {!isLoading && isEmpty && !isIdle && (
          <span className="data-point__placeholder">No data</span>
        )}
        {!isLoading && error && (
          <span className="data-point__error">Error: {error}</span>
        )}
        {!isLoading && !error && data !== null && (
          <>
            <span className="data-point__value" style={valueStyle}>
              {formatValue(data, precision)}
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
