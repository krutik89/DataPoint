# IOsense API Tracking — DataPoint Widget

Project: `widget/` — webpack-bundled React widget per SKILLS.md.

## Components

| Name | Webpack entry | Self-registered as |
|------|---------------|-------------------|
| DataPoint | `src/components/DataPoint/index.ts` | `window.ReactWidgets.DataPoint` |
| DataPointConfiguration | `src/components/DataPointConfiguration/index.ts` | `window.ReactWidgets.DataPointConfiguration` |

## API Calls (functionIDs)

| functionID | Where used | Purpose |
|------------|-----------|---------|
| `validateSSOToken` | `iosense-sdk/api.ts` → `App.tsx` (dev only) | Exchange `?token=` SSO token for Bearer JWT, store in localStorage |
| `findUserDevices` | `DataPointConfiguration.tsx` | Debounced (300ms) device search for the device AutocompleteInput. Note: response nests at `data.data` |
| `getDeviceSpecificMetadata` | `iosense-sdk/api.ts` (helper, available) | Reserved for fetching full sensor metadata for a selected device |
| `getWidgetData` (`type: "pieChart"`) | `iosense-sdk/api.ts` → `DataPoint.tsx` | Aggregated single value for the configured device/sensor using one of: `sum`, `min`, `max`, `consumption`, `lastDP`, `firstDP` |

## Endpoints

- `GET  /api/retrieve-sso-token/{token}`
- `PUT  /api/account/devices/{skip}/{limit}`
- `GET  /api/account/ai-sdk/metaData/device/{devID}`
- `PUT  /api/account/ioLensWidget/getWidgetData`

Base: `https://connector.iosense.io`

## Config Shape

`WidgetConfig` defined in [widget/src/iosense-sdk/types.ts](widget/src/iosense-sdk/types.ts).
Key fields: `source { devID, sensorId, operator }`, `precision`, `unit`, `timeRangeHours`, `timezone`, plus card/text styling.
