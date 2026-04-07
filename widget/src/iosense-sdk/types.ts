export interface ApiResponse<T> {
  success: boolean;
  data: T;
}

export interface DeviceSensor {
  sensorId: string;
  sensorName: string;
}

export interface Device {
  devID: string;
  devName: string;
  devTypeID?: string;
  devTypeName?: string;
  sensors: DeviceSensor[];
  unitSelected?: Record<string, string>;
}

export interface DevicesPage {
  totalCount: number;
  data: Device[];
}

export type Operator =
  | 'sum'
  | 'min'
  | 'max'
  | 'consumption'
  | 'lastDP'
  | 'firstDP';

export type ClusterOperator = 'sum' | 'mean' | 'max' | 'min' | 'median' | 'mode';

export type DurationPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';
export type DurationEvent = 'start' | 'now' | 'end';
export type DurationNavigation = 'previous' | 'next';

export interface Duration {
  id: string;
  name: string;
  navigation: DurationNavigation;
  xNumber: number;
  xPeriod: DurationPeriod;
  xEvent: DurationEvent;
  yNumber: number;
  yPeriod: DurationPeriod;
  yEvent: DurationEvent;
  periodicity: DurationPeriod;
}

export type SourceType = 'device' | 'cluster' | 'compute';

export interface DataPointSource {
  sourceType: SourceType;

  // Device source
  devID?: string;
  devName?: string;
  sensorId?: string;
  sensorName?: string;
  operator?: Operator;

  // Cluster source
  clusterID?: string;
  clusterName?: string;
  clusterOperator?: ClusterOperator;
  clusterTimeOperator?: Operator;

  // Compute source
  flowId?: string;
  flowParameters?: string;

  // Display
  precision?: number;
}

export interface WidgetConfig {
  // Title / display
  title?: string;
  subtitle?: string;

  // Data
  source?: DataPointSource;
  unit?: string;

  // Time window (hours of history) — used as fallback when no duration is set
  timeRangeHours?: number;
  timezone?: string;
  timeType?: 'fixed';

  // Durations (DatePicker presets)
  durations?: Duration[];
  defaultDurationId?: string;

  // Cycle time
  cycleIdentifier?: 'start' | 'end';
  cycleHour?: number;
  cycleMinute?: number;
  cycleDays?: string[];

  // Card styling
  wrapInCard?: boolean;

  // Styling
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  padding?: number;

  titleColor?: string;
  titleFontSize?: number;

  valueColor?: string;
  valueFontSize?: number;

  unitColor?: string;
  unitFontSize?: number;
}
