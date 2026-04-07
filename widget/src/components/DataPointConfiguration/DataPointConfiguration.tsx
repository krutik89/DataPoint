import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion,
  AccordionItem,
  ActionListItem,
  ActionListItemGroup,
  AutocompleteInput,
  Button,
  DateSelectorButton,
  DateSelectorGroup,
  DropdownMenu,
  Radio,
  RadioGroup,
  SelectInput,
  Spinner,
  Switch,
  TabItem,
  Tabs,
  TextInput,
} from '@faclon-labs/design-sdk';
import { findUserDevices, getDeviceSpecificMetadata } from '../../iosense-sdk/api';
import type {
  ClusterOperator,
  DataPointSource,
  Device,
  DeviceSensor,
  Duration,
  DurationEvent,
  DurationNavigation,
  DurationPeriod,
  Operator,
  SourceType,
  WidgetConfig,
} from '../../iosense-sdk/types';
import './DataPointConfiguration.css';

const DEVICE_OPERATORS: { value: Operator; label: string; description: string }[] = [
  { value: 'lastDP',      label: 'Last DP',     description: 'Most recent value' },
  { value: 'firstDP',     label: 'First DP',    description: 'Oldest value in range' },
  { value: 'sum',         label: 'Sum',         description: 'Total of values in range' },
  { value: 'min',         label: 'Min',         description: 'Lowest value in range' },
  { value: 'max',         label: 'Max',         description: 'Highest value in range' },
  { value: 'consumption', label: 'Consumption', description: 'Last minus first value' },
];

const CLUSTER_OPERATORS: { value: ClusterOperator; label: string }[] = [
  { value: 'sum',    label: 'Sum' },
  { value: 'mean',   label: 'Mean' },
  { value: 'max',    label: 'Max' },
  { value: 'min',    label: 'Min' },
  { value: 'median', label: 'Median' },
  { value: 'mode',   label: 'Mode' },
];

const TIMEZONE_OPTIONS = [
  'Asia/Calcutta',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Australia/Sydney',
  'UTC',
];

const TIME_TYPE_OPTIONS: { value: 'fixed'; label: string }[] = [
  { value: 'fixed', label: 'Fixed Time' },
];

const DURATION_PERIOD_OPTIONS: { value: 'hour' | 'day' | 'week' | 'month' | 'year'; label: string }[] = [
  { value: 'hour',  label: 'Hour' },
  { value: 'day',   label: 'Day' },
  { value: 'week',  label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year',  label: 'Year' },
];

const DURATION_EVENT_OPTIONS: { value: 'start' | 'now' | 'end'; label: string }[] = [
  { value: 'start', label: 'Start' },
  { value: 'now',   label: 'Now' },
  { value: 'end',   label: 'End' },
];

const DURATION_NAV_OPTIONS: { value: 'previous' | 'next'; label: string }[] = [
  { value: 'previous', label: 'Previous' },
  { value: 'next',     label: 'Next' },
];

function makeBlankDuration(): Duration {
  return {
    id: `dur_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: '',
    navigation: 'previous',
    xNumber: 1,
    xPeriod: 'day',
    xEvent: 'start',
    yNumber: 0,
    yPeriod: 'day',
    yEvent: 'now',
    periodicity: 'hour',
  };
}

function describeDuration(d: Duration): string {
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(d.navigation)} ${d.xNumber} ${d.xPeriod}(${d.xEvent}) → ${d.yNumber} ${d.yPeriod}(${d.yEvent}) · ${cap(d.periodicity)}`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}));
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, i) => ({
  value: String(i),
  label: String(i).padStart(2, '0'),
}));

const DAY_OPTIONS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_RANGE_OPTIONS = [
  { value: '1',   label: 'Last 1 hour' },
  { value: '6',   label: 'Last 6 hours' },
  { value: '12',  label: 'Last 12 hours' },
  { value: '24',  label: 'Last 24 hours' },
  { value: '168', label: 'Last 7 days' },
  { value: '720', label: 'Last 30 days' },
];

const EMPTY_SOURCE: DataPointSource = {
  sourceType: 'device',
  devID: '',
  devName: '',
  sensorId: '',
  sensorName: '',
  operator: 'lastDP',
  precision: 2,
};

interface ColorInputProps {
  label: string;
  name: string;
  value: string;
  onChange: (v: string) => void;
}

function ColorInput({ label, name, value, onChange }: ColorInputProps) {
  return (
    <div className="dpc-color-field">
      <div className="dpc-color-input-wrap">
        <TextInput
          label={label}
          name={`${name}-hex`}
          value={value}
          placeholder="#ffffff"
          onChange={({ value: v }: { value: string }) => onChange(v)}
        />
        <div className="dpc-color-swatch" style={{ background: value || '#ffffff' }}>
          <input
            type="color"
            className="dpc-color-native"
            value={value || '#ffffff'}
            onChange={(e) => onChange(e.target.value)}
            title={label}
          />
        </div>
      </div>
    </div>
  );
}

function useDropdown() {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);
  const close = useCallback(() => setOpen(false), []);
  return { open, toggle, close };
}

// ─── DurationForm ─────────────────────────────────────────────────────────

interface DurationFormProps {
  id: string;
  duration: Duration;
  onChange: (next: Duration) => void;
}

function DurationForm({ id, duration, onChange }: DurationFormProps) {
  const navDd = useDropdown();
  const xPeriodDd = useDropdown();
  const xEventDd = useDropdown();
  const yPeriodDd = useDropdown();
  const yEventDd = useDropdown();
  const periodicityDd = useDropdown();

  const findLabel = <T extends string>(
    list: { value: T; label: string }[],
    v: T
  ): string => list.find((o) => o.value === v)?.label ?? '';

  const update = (patch: Partial<Duration>) => onChange({ ...duration, ...patch });

  return (
    <div className="dpc-duration-form" id={id}>
      <TextInput
        label="Duration Name"
        name={`${id}-name`}
        value={duration.name}
        onChange={({ value: v }: { value: string }) => update({ name: v })}
      />

      <SelectInput
        label="Navigation"
        name={`${id}-nav`}
        value={findLabel(DURATION_NAV_OPTIONS, duration.navigation)}
        isOpen={navDd.open}
        onClick={navDd.toggle}
      >
        <DropdownMenu>
          {DURATION_NAV_OPTIONS.map((opt) => (
            <ActionListItem
              id={opt.value}
              title={opt.label}
              selectionType="Single"
              isSelected={opt.value === duration.navigation}
              onClick={() => {
                update({ navigation: opt.value as DurationNavigation });
                navDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>

      {/* X row */}
      <div className="dpc-row">
        <TextInput
          label="X"
          name={`${id}-x-num`}
          type="number"
          value={String(duration.xNumber)}
          onChange={({ value: v }: { value: string }) => {
            const n = parseInt(v, 10);
            if (!isNaN(n)) update({ xNumber: n });
          }}
        />
        <SelectInput
          label="X Period"
          name={`${id}-x-period`}
          value={findLabel(DURATION_PERIOD_OPTIONS, duration.xPeriod)}
          isOpen={xPeriodDd.open}
          onClick={xPeriodDd.toggle}
        >
          <DropdownMenu>
            {DURATION_PERIOD_OPTIONS.map((opt) => (
              <ActionListItem
                id={opt.value}
                title={opt.label}
                selectionType="Single"
                isSelected={opt.value === duration.xPeriod}
                onClick={() => {
                  update({ xPeriod: opt.value as DurationPeriod });
                  xPeriodDd.close();
                }}
              />
            ))}
          </DropdownMenu>
        </SelectInput>
      </div>

      <SelectInput
        label="X Event"
        name={`${id}-x-event`}
        value={findLabel(DURATION_EVENT_OPTIONS, duration.xEvent)}
        isOpen={xEventDd.open}
        onClick={xEventDd.toggle}
      >
        <DropdownMenu>
          {DURATION_EVENT_OPTIONS.map((opt) => (
            <ActionListItem
              id={opt.value}
              title={opt.label}
              selectionType="Single"
              isSelected={opt.value === duration.xEvent}
              onClick={() => {
                update({ xEvent: opt.value as DurationEvent });
                xEventDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>

      {/* Y row */}
      <div className="dpc-row">
        <TextInput
          label="Y"
          name={`${id}-y-num`}
          type="number"
          value={String(duration.yNumber)}
          onChange={({ value: v }: { value: string }) => {
            const n = parseInt(v, 10);
            if (!isNaN(n)) update({ yNumber: n });
          }}
        />
        <SelectInput
          label="Y Period"
          name={`${id}-y-period`}
          value={findLabel(DURATION_PERIOD_OPTIONS, duration.yPeriod)}
          isOpen={yPeriodDd.open}
          onClick={yPeriodDd.toggle}
        >
          <DropdownMenu>
            {DURATION_PERIOD_OPTIONS.map((opt) => (
              <ActionListItem
                id={opt.value}
                title={opt.label}
                selectionType="Single"
                isSelected={opt.value === duration.yPeriod}
                onClick={() => {
                  update({ yPeriod: opt.value as DurationPeriod });
                  yPeriodDd.close();
                }}
              />
            ))}
          </DropdownMenu>
        </SelectInput>
      </div>

      <SelectInput
        label="Y Event"
        name={`${id}-y-event`}
        value={findLabel(DURATION_EVENT_OPTIONS, duration.yEvent)}
        isOpen={yEventDd.open}
        onClick={yEventDd.toggle}
      >
        <DropdownMenu>
          {DURATION_EVENT_OPTIONS.map((opt) => (
            <ActionListItem
              id={opt.value}
              title={opt.label}
              selectionType="Single"
              isSelected={opt.value === duration.yEvent}
              onClick={() => {
                update({ yEvent: opt.value as DurationEvent });
                yEventDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>

      <SelectInput
        label="Periodicity"
        name={`${id}-periodicity`}
        value={findLabel(DURATION_PERIOD_OPTIONS, duration.periodicity)}
        isOpen={periodicityDd.open}
        onClick={periodicityDd.toggle}
      >
        <DropdownMenu>
          {DURATION_PERIOD_OPTIONS.map((opt) => (
            <ActionListItem
              id={opt.value}
              title={opt.label}
              selectionType="Single"
              isSelected={opt.value === duration.periodicity}
              onClick={() => {
                update({ periodicity: opt.value as DurationPeriod });
                periodicityDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>
    </div>
  );
}

interface DataPointConfigurationProps {
  config?: WidgetConfig;
  value?: WidgetConfig;
  authentication: string;
  onChange: (config: WidgetConfig) => void;
}

export function DataPointConfiguration({
  config: configProp,
  value: valueProp,
  authentication,
  onChange,
}: DataPointConfigurationProps) {
  const [config, setConfig] = useState<WidgetConfig>(configProp ?? valueProp ?? {});
  const [activeTab, setActiveTab] = useState<'data' | 'time' | 'style'>('data');

  useEffect(() => {
    setConfig(configProp ?? valueProp ?? {});
  }, [configProp, valueProp]);

  const handleChange = useCallback(
    (next: WidgetConfig) => {
      setConfig(next);
      onChange(next);
    },
    [onChange]
  );

  const source = config.source ?? { ...EMPTY_SOURCE };
  const sourceType: SourceType = source.sourceType ?? 'device';

  const updateSource = (patch: Partial<DataPointSource>) =>
    handleChange({ ...config, source: { ...source, ...patch } });

  // ── Device autocomplete state ─────────────────────────────────────────────
  const [deviceQuery, setDeviceQuery] = useState(source.devName ?? '');
  const [deviceOpen, setDeviceOpen] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const deviceWrapRef = useRef<HTMLDivElement>(null);

  // Sensors mapped to the currently-selected device
  const [deviceSensors, setDeviceSensors] = useState<DeviceSensor[]>([]);
  const [sensorsLoading, setSensorsLoading] = useState(false);

  // ── Sensor select state ───────────────────────────────────────────────────
  const [sensorQuery, setSensorQuery] = useState(source.sensorName ?? '');
  const [sensorOpen, setSensorOpen] = useState(false);
  const sensorWrapRef = useRef<HTMLDivElement>(null);

  const operatorDd = useDropdown();
  const clusterOperatorDd = useDropdown();
  const clusterTimeOperatorDd = useDropdown();
  const timeTypeDd = useDropdown();
  const cycleHourDd = useDropdown();
  const cycleMinuteDd = useDropdown();

  // Duration draft state — single editable form
  const [draftDuration, setDraftDuration] = useState<Duration>(() => makeBlankDuration());
  const [editingDurationId, setEditingDurationId] = useState<string | null>(null);

  // Timezone autocomplete state
  const [timezoneQuery, setTimezoneQuery] = useState(config.timezone ?? 'Asia/Calcutta');
  const [timezoneOpen, setTimezoneOpen] = useState(false);
  const timezoneWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setTimezoneQuery(config.timezone ?? 'Asia/Calcutta');
  }, [config.timezone]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (timezoneWrapRef.current && !timezoneWrapRef.current.contains(e.target as Node)) {
        setTimezoneOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  useEffect(() => {
    setDeviceQuery(source.devName ?? '');
    setSensorQuery(source.sensorName ?? '');
  }, [source.devName, source.sensorName]);

  // Fetch sensors for the selected device — runs on devID change so re-opening
  // a saved widget always shows the mapped sensor list
  useEffect(() => {
    if (!source.devID || sourceType !== 'device') {
      setDeviceSensors([]);
      return;
    }
    let cancelled = false;
    setSensorsLoading(true);
    getDeviceSpecificMetadata(authentication, source.devID)
      .then((meta) => {
        if (cancelled) return;
        setDeviceSensors(meta?.sensors ?? []);
        setSensorsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setSensorsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [authentication, source.devID, sourceType]);

  // Debounced device search on every input change
  useEffect(() => {
    if (sourceType !== 'device') return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDevicesLoading(true);
      findUserDevices(authentication, deviceQuery)
        .then((data) => {
          setDevices(data);
          setDevicesLoading(false);
        })
        .catch(() => setDevicesLoading(false));
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [authentication, deviceQuery, sourceType]);

  // Click-outside close
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (deviceWrapRef.current && !deviceWrapRef.current.contains(e.target as Node)) {
        setDeviceOpen(false);
      }
      if (sensorWrapRef.current && !sensorWrapRef.current.contains(e.target as Node)) {
        setSensorOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const filteredSensors = deviceSensors.filter((s) =>
    s.sensorName.toLowerCase().includes(sensorQuery.toLowerCase())
  );

  const selectedOperator = DEVICE_OPERATORS.find((o) => o.value === source.operator);
  const selectedClusterOperator = CLUSTER_OPERATORS.find(
    (o) => o.value === source.clusterOperator
  );
  const selectedClusterTimeOperator = DEVICE_OPERATORS.find(
    (o) => o.value === source.clusterTimeOperator
  );

  const precision = source.precision ?? 2;

  function handleDeviceSelect(d: Device) {
    setDeviceQuery(d.devName);
    setDeviceOpen(false);
    setSensorQuery('');
    updateSource({
      devID: d.devID,
      devName: d.devName,
      sensorId: '',
      sensorName: '',
    });
    // Pre-load sensors immediately from the search response so they appear instantly
    setDeviceSensors(d.sensors ?? []);
  }

  function handleSensorSelect(s: DeviceSensor) {
    setSensorQuery(s.sensorName);
    setSensorOpen(false);
    updateSource({ sensorId: s.sensorId, sensorName: s.sensorName });
  }

  // ── Sub-renders for source type ──────────────────────────────────────────

  const renderDeviceFields = () => (
    <>
      <div ref={deviceWrapRef}>
        <AutocompleteInput
          label="Device"
          placeholder="Search devices…"
          name="dp-device"
          inputValue={deviceQuery}
          isOpen={deviceOpen && (devicesLoading || devices.length > 0)}
          onInputChange={(v: string) => {
            setDeviceQuery(v);
            setDeviceOpen(true);
            if (v !== source.devName) {
              updateSource({
                devID: '',
                devName: '',
                sensorId: '',
                sensorName: '',
              });
            }
          }}
        >
          <DropdownMenu>
            {devicesLoading ? (
              <div className="dpc-dropdown-center">
                <Spinner />
              </div>
            ) : devices.length === 0 ? (
              <ActionListItem id="no-devices" title="No devices found" isDisabled />
            ) : (
              devices.map((d) => (
                <ActionListItem
                  id={d.devID}
                  title={d.devName}
                  description={d.devID}
                  selectionType="Single"
                  isSelected={d.devID === source.devID}
                  onClick={() => handleDeviceSelect(d)}
                />
              ))
            )}
          </DropdownMenu>
        </AutocompleteInput>
      </div>

      <div ref={sensorWrapRef}>
        <AutocompleteInput
          label="Sensor"
          placeholder={
            !source.devID
              ? 'Select a device first'
              : sensorsLoading
              ? 'Loading sensors…'
              : 'Search sensors…'
          }
          name="dp-sensor"
          inputValue={sensorQuery}
          isDisabled={!source.devID}
          isOpen={sensorOpen && (sensorsLoading || filteredSensors.length > 0)}
          onInputChange={(v: string) => {
            setSensorQuery(v);
            setSensorOpen(true);
          }}
        >
          <DropdownMenu>
            {sensorsLoading ? (
              <div className="dpc-dropdown-center">
                <Spinner />
              </div>
            ) : filteredSensors.length === 0 ? (
              <ActionListItem id="no-sensors" title="No sensors found" isDisabled />
            ) : (
              filteredSensors.map((s) => (
                <ActionListItem
                  id={s.sensorId}
                  title={s.sensorName}
                  description={s.sensorId}
                  selectionType="Single"
                  isSelected={s.sensorId === source.sensorId}
                  onClick={() => handleSensorSelect(s)}
                />
              ))
            )}
          </DropdownMenu>
        </AutocompleteInput>
      </div>

      <SelectInput
        label="Operator"
        name="dp-operator"
        value={selectedOperator?.label ?? ''}
        isOpen={operatorDd.open}
        onClick={operatorDd.toggle}
      >
        <DropdownMenu>
          {DEVICE_OPERATORS.map((op) => (
            <ActionListItem
              id={op.value}
              title={op.label}
              description={op.description}
              selectionType="Single"
              isSelected={op.value === source.operator}
              onClick={() => {
                updateSource({ operator: op.value });
                operatorDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>
    </>
  );

  const renderClusterFields = () => (
    <>
      <TextInput
        label="Cluster ID"
        name="dp-cluster-id"
        placeholder="e.g. CL_1023"
        value={source.clusterID ?? ''}
        onChange={({ value: v }: { value: string }) =>
          updateSource({ clusterID: v, clusterName: v })
        }
      />
      <SelectInput
        label="Cluster Operator"
        name="dp-cluster-operator"
        value={selectedClusterOperator?.label ?? ''}
        isOpen={clusterOperatorDd.open}
        onClick={clusterOperatorDd.toggle}
      >
        <DropdownMenu>
          {CLUSTER_OPERATORS.map((op) => (
            <ActionListItem
              id={op.value}
              title={op.label}
              selectionType="Single"
              isSelected={op.value === source.clusterOperator}
              onClick={() => {
                updateSource({ clusterOperator: op.value });
                clusterOperatorDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>
      <SelectInput
        label="Time Operator"
        name="dp-cluster-time-operator"
        value={selectedClusterTimeOperator?.label ?? ''}
        isOpen={clusterTimeOperatorDd.open}
        onClick={clusterTimeOperatorDd.toggle}
      >
        <DropdownMenu>
          {DEVICE_OPERATORS.map((op) => (
            <ActionListItem
              id={op.value}
              title={op.label}
              description={op.description}
              selectionType="Single"
              isSelected={op.value === source.clusterTimeOperator}
              onClick={() => {
                updateSource({ clusterTimeOperator: op.value });
                clusterTimeOperatorDd.close();
              }}
            />
          ))}
        </DropdownMenu>
      </SelectInput>
    </>
  );

  const renderComputeFields = () => (
    <>
      <TextInput
        label="Flow ID"
        name="dp-flow-id"
        placeholder="e.g. flow_abc123"
        value={source.flowId ?? ''}
        onChange={({ value: v }: { value: string }) => updateSource({ flowId: v })}
      />
      <TextInput
        label="Flow Parameters"
        name="dp-flow-params"
        placeholder='e.g. {"foo":"bar"}'
        value={source.flowParameters ?? ''}
        onChange={({ value: v }: { value: string }) =>
          updateSource({ flowParameters: v })
        }
      />
    </>
  );

  // ── Tabs ─────────────────────────────────────────────────────────────────

  const renderDataTab = () => (
    <div className="dpc-tab">
      <Accordion mode="multiple" defaultExpandedKeys={['display', 'source']}>
        <AccordionItem value="display" title="Display">
          <div className="dpc-acc-body">
            <TextInput
              label="Title"
              name="dp-title"
              placeholder="e.g. Energy Consumption"
              value={config.title ?? ''}
              onChange={({ value: v }: { value: string }) =>
                handleChange({ ...config, title: v })
              }
            />
            <TextInput
              label="Subtitle"
              name="dp-subtitle"
              placeholder="Optional"
              value={config.subtitle ?? ''}
              onChange={({ value: v }: { value: string }) =>
                handleChange({ ...config, subtitle: v })
              }
            />
          </div>
        </AccordionItem>

        <AccordionItem value="source" title="Data Source">
          <div className="dpc-acc-body">
            <RadioGroup
              name="dp-source-type"
              value={sourceType}
              orientation="Horizontal"
              onChange={(v: string) => updateSource({ sourceType: v as SourceType })}
            >
              <Radio label="Device" value="device" />
              <Radio label="Cluster" value="cluster" />
              <Radio label="Compute" value="compute" />
            </RadioGroup>

            {sourceType === 'device' && renderDeviceFields()}
            {sourceType === 'cluster' && renderClusterFields()}
            {sourceType === 'compute' && renderComputeFields()}

            <TextInput
              label="Unit"
              name="dp-unit"
              placeholder="kWh, °C, %…"
              value={config.unit ?? ''}
              onChange={({ value: v }: { value: string }) =>
                handleChange({ ...config, unit: v })
              }
            />
            <TextInput
              label="Data Precision"
              name="dp-precision"
              type="number"
              value={String(precision)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) updateSource({ precision: n });
              }}
            />
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );

  const renderTimeTab = () => {
    const timeType = config.timeType ?? 'fixed';
    const selectedTimeType = TIME_TYPE_OPTIONS.find((o) => o.value === timeType);
    const cycleIdentifier = config.cycleIdentifier ?? 'start';
    const durations = config.durations ?? [];
    const cycleHour = config.cycleHour ?? 0;
    const cycleMinute = config.cycleMinute ?? 0;
    const cycleDays = config.cycleDays ?? [];

    const selectedCycleHour = HOUR_OPTIONS.find((o) => o.value === String(cycleHour));
    const selectedCycleMinute = MINUTE_OPTIONS.find((o) => o.value === String(cycleMinute));

    const tzFiltered = TIMEZONE_OPTIONS.filter((tz) =>
      tz.toLowerCase().includes(timezoneQuery.toLowerCase())
    );

    return (
      <div className="dpc-tab">
        {/* Timezone & Time Type — no accordion, padded */}
        <div className="dpc-tab-padded">
          <div ref={timezoneWrapRef}>
            <AutocompleteInput
              label="Timezone"
              name="dp-timezone"
              placeholder="Search timezone…"
              inputValue={timezoneQuery}
              isOpen={timezoneOpen && tzFiltered.length > 0}
              onInputChange={(v: string) => {
                setTimezoneQuery(v);
                setTimezoneOpen(true);
              }}
            >
              <DropdownMenu>
                {tzFiltered.map((tz) => (
                  <ActionListItem
                    id={tz}
                    title={tz}
                    selectionType="Single"
                    isSelected={tz === config.timezone}
                    onClick={() => {
                      handleChange({ ...config, timezone: tz });
                      setTimezoneQuery(tz);
                      setTimezoneOpen(false);
                    }}
                  />
                ))}
              </DropdownMenu>
            </AutocompleteInput>
          </div>

          <SelectInput
            label="Time Type"
            name="dp-time-type"
            value={selectedTimeType?.label ?? ''}
            isOpen={timeTypeDd.open}
            onClick={timeTypeDd.toggle}
          >
            <DropdownMenu>
              {TIME_TYPE_OPTIONS.map((opt) => (
                <ActionListItem
                  id={opt.value}
                  title={opt.label}
                  selectionType="Single"
                  isSelected={opt.value === timeType}
                  onClick={() => {
                    handleChange({ ...config, timeType: opt.value });
                    timeTypeDd.close();
                  }}
                />
              ))}
            </DropdownMenu>
          </SelectInput>
        </div>

        <Accordion mode="multiple" defaultExpandedKeys={['cycle', 'durations']}>
          <AccordionItem value="cycle" title="Cycle Time">
            <div className="dpc-acc-body">
              <RadioGroup
                label="Cycle Time Identifier"
                name="dp-cycle-identifier"
                value={cycleIdentifier}
                orientation="Horizontal"
                onChange={(v: string) =>
                  handleChange({
                    ...config,
                    cycleIdentifier: v as 'start' | 'end',
                  })
                }
              >
                <Radio label="Start" value="start" />
                <Radio label="End" value="end" />
              </RadioGroup>

              <div className="dpc-row">
                <SelectInput
                  label="Hour"
                  name="dp-cycle-hour"
                  value={selectedCycleHour?.label ?? ''}
                  isOpen={cycleHourDd.open}
                  onClick={cycleHourDd.toggle}
                >
                  <DropdownMenu>
                    {HOUR_OPTIONS.map((opt) => (
                      <ActionListItem
                        id={opt.value}
                        title={opt.label}
                        selectionType="Single"
                        isSelected={opt.value === String(cycleHour)}
                        onClick={() => {
                          handleChange({ ...config, cycleHour: parseInt(opt.value, 10) });
                          cycleHourDd.close();
                        }}
                      />
                    ))}
                  </DropdownMenu>
                </SelectInput>
                <SelectInput
                  label="Minute"
                  name="dp-cycle-minute"
                  value={selectedCycleMinute?.label ?? ''}
                  isOpen={cycleMinuteDd.open}
                  onClick={cycleMinuteDd.toggle}
                >
                  <DropdownMenu>
                    {MINUTE_OPTIONS.map((opt) => (
                      <ActionListItem
                        id={opt.value}
                        title={opt.label}
                        selectionType="Single"
                        isSelected={opt.value === String(cycleMinute)}
                        onClick={() => {
                          handleChange({ ...config, cycleMinute: parseInt(opt.value, 10) });
                          cycleMinuteDd.close();
                        }}
                      />
                    ))}
                  </DropdownMenu>
                </SelectInput>
              </div>

              <DateSelectorGroup label="Days">
                {DAY_OPTIONS.map((d) => (
                  <DateSelectorButton
                    label={d}
                    isActive={cycleDays.includes(d)}
                    onClick={() => {
                      const next = cycleDays.includes(d)
                        ? cycleDays.filter((x) => x !== d)
                        : [...cycleDays, d];
                      handleChange({ ...config, cycleDays: next });
                    }}
                  />
                ))}
              </DateSelectorGroup>
            </div>
          </AccordionItem>

          <AccordionItem value="durations" title="Duration">
            <div className="dpc-acc-body">
              <DurationForm
                id="dp-duration-form"
                duration={draftDuration}
                onChange={(next) => setDraftDuration(next)}
              />

              <div className="dpc-actions-right">
                <Button
                  label={editingDurationId ? 'Save Duration' : 'Add Duration'}
                  variant="Secondary"
                  size="Small"
                  isDisabled={!draftDuration.name.trim()}
                  onClick={() => {
                    if (editingDurationId) {
                      const arr = durations.map((d) =>
                        d.id === editingDurationId ? { ...draftDuration, id: editingDurationId } : d
                      );
                      handleChange({ ...config, durations: arr });
                      setEditingDurationId(null);
                    } else {
                      handleChange({
                        ...config,
                        durations: [...durations, draftDuration],
                      });
                    }
                    setDraftDuration(makeBlankDuration());
                  }}
                />
                {editingDurationId && (
                  <Button
                    label="Cancel"
                    variant="Tertiary"
                    size="Small"
                    onClick={() => {
                      setEditingDurationId(null);
                      setDraftDuration(makeBlankDuration());
                    }}
                  />
                )}
              </div>

              {durations.length > 0 && (
                <div className="dpc-duration-list">
                  <ActionListItemGroup>
                    {durations.map((d) => {
                      const isDefault = config.defaultDurationId === d.id;
                      return (
                        <div className="dpc-duration-row" id={`row-${d.id}`}>
                          <ActionListItem
                            title={d.name || '(unnamed)'}
                            description={describeDuration(d)}
                            isSelected={isDefault}
                            badges={
                              isDefault ? (
                                <span className="dpc-default-badge">DEFAULT</span>
                              ) : undefined
                            }
                            trailing={
                              <div className="dpc-duration-actions">
                                <Button
                                  label={isDefault ? 'Unset' : 'Default'}
                                  variant="Tertiary"
                                  size="Small"
                                  onClick={() =>
                                    handleChange({
                                      ...config,
                                      defaultDurationId: isDefault ? undefined : d.id,
                                    })
                                  }
                                />
                                <Button
                                  label="Edit"
                                  variant="Tertiary"
                                  size="Small"
                                  onClick={() => {
                                    setDraftDuration({ ...d });
                                    setEditingDurationId(d.id);
                                  }}
                                />
                                <Button
                                  label="Delete"
                                  variant="Tertiary"
                                  color="Negative"
                                  size="Small"
                                  onClick={() => {
                                    const arr = durations.filter((x) => x.id !== d.id);
                                    handleChange({
                                      ...config,
                                      durations: arr,
                                      defaultDurationId:
                                        config.defaultDurationId === d.id
                                          ? undefined
                                          : config.defaultDurationId,
                                    });
                                    if (editingDurationId === d.id) {
                                      setEditingDurationId(null);
                                      setDraftDuration(makeBlankDuration());
                                    }
                                  }}
                                />
                              </div>
                            }
                          />
                        </div>
                      );
                    })}
                  </ActionListItemGroup>
                </div>
              )}
            </div>
          </AccordionItem>
        </Accordion>
      </div>
    );
  };

  const renderStyleTab = () => (
    <div className="dpc-tab">
      <Accordion mode="multiple" defaultExpandedKeys={['card', 'text']}>
        <AccordionItem value="card" title="Card Styling">
          <div className="dpc-acc-body">
            <div className="dpc-switch-row">
              <span className="BodySmallRegular">Wrap into Card</span>
              <Switch
                name="dp-wrap-card"
                isChecked={config.wrapInCard ?? true}
                onChange={({ checked }: { checked: boolean }) =>
                  handleChange({ ...config, wrapInCard: checked })
                }
                accessibilityLabel="Wrap into Card"
              />
            </div>
            <ColorInput
              label="Background color"
              name="dp-bg"
              value={config.backgroundColor ?? '#ffffff'}
              onChange={(v) => handleChange({ ...config, backgroundColor: v })}
            />
            <ColorInput
              label="Border color"
              name="dp-border"
              value={config.borderColor ?? '#e5e7eb'}
              onChange={(v) => handleChange({ ...config, borderColor: v })}
            />
            <TextInput
              label="Border width (px)"
              name="dp-border-width"
              value={String(config.borderWidth ?? 1)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) handleChange({ ...config, borderWidth: n });
              }}
            />
            <TextInput
              label="Border radius (px)"
              name="dp-border-radius"
              value={String(config.borderRadius ?? 8)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) handleChange({ ...config, borderRadius: n });
              }}
            />
            <TextInput
              label="Padding (px)"
              name="dp-padding"
              value={String(config.padding ?? 16)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n >= 0) handleChange({ ...config, padding: n });
              }}
            />
          </div>
        </AccordionItem>

        <AccordionItem value="text" title="Text Styling">
          <div className="dpc-acc-body">
            <ColorInput
              label="Title color"
              name="dp-title-color"
              value={config.titleColor ?? '#6b7280'}
              onChange={(v) => handleChange({ ...config, titleColor: v })}
            />
            <TextInput
              label="Title font size (px)"
              name="dp-title-fz"
              value={String(config.titleFontSize ?? 14)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) handleChange({ ...config, titleFontSize: n });
              }}
            />
            <ColorInput
              label="Value color"
              name="dp-value-color"
              value={config.valueColor ?? '#111827'}
              onChange={(v) => handleChange({ ...config, valueColor: v })}
            />
            <TextInput
              label="Value font size (px)"
              name="dp-value-fz"
              value={String(config.valueFontSize ?? 36)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) handleChange({ ...config, valueFontSize: n });
              }}
            />
            <ColorInput
              label="Unit color"
              name="dp-unit-color"
              value={config.unitColor ?? '#6b7280'}
              onChange={(v) => handleChange({ ...config, unitColor: v })}
            />
            <TextInput
              label="Unit font size (px)"
              name="dp-unit-fz"
              value={String(config.unitFontSize ?? 16)}
              onChange={({ value: v }: { value: string }) => {
                const n = parseInt(v, 10);
                if (!isNaN(n) && n > 0) handleChange({ ...config, unitFontSize: n });
              }}
            />
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );

  return (
    <div className="dpc">
      <Tabs variant="Bordered" size="Medium" isFullWidth>
        <TabItem
          label="Data"
          variant="Bordered"
          size="Medium"
          isFullWidth
          isSelected={activeTab === 'data'}
          onClick={() => setActiveTab('data')}
        />
        <TabItem
          label="Time"
          variant="Bordered"
          size="Medium"
          isFullWidth
          isSelected={activeTab === 'time'}
          onClick={() => setActiveTab('time')}
        />
        <TabItem
          label="Style"
          variant="Bordered"
          size="Medium"
          isFullWidth
          isSelected={activeTab === 'style'}
          onClick={() => setActiveTab('style')}
        />
      </Tabs>
      {activeTab === 'data' && renderDataTab()}
      {activeTab === 'time' && renderTimeTab()}
      {activeTab === 'style' && renderStyleTab()}
    </div>
  );
}
