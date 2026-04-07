import React, { useEffect, useRef, useState } from 'react';
import '@faclon-labs/design-sdk/styles.css';
import { validateSSOToken } from './iosense-sdk/api';
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
  const widgetMounted = useRef(false);
  const configMounted = useRef(false);

  const authentication = localStorage.getItem('bearer_token') ?? '';

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ssoToken = params.get('token');

    if (ssoToken) {
      params.delete('token');
      const newUrl = `${window.location.pathname}${
        params.toString() ? `?${params}` : ''
      }`;
      window.history.replaceState({}, '', newUrl);

      validateSSOToken(ssoToken)
        .then(() => setAuthenticated(true))
        .catch((err) => setAuthError(err instanceof Error ? err.message : 'Auth failed'));
    } else if (localStorage.getItem('bearer_token')) {
      setAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    if (!authenticated) return;

    const widgetProps = { config, authentication };
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
      window.ReactWidgets['DataPointConfiguration'].mount(CONFIG_ID, configProps);
      configMounted.current = true;
    } else {
      window.ReactWidgets['DataPointConfiguration'].update(CONFIG_ID, configProps);
    }
  }, [authenticated, config, authentication]);

  useEffect(() => {
    return () => {
      if (widgetMounted.current) {
        window.ReactWidgets['DataPoint']?.unmount(WIDGET_ID);
      }
      if (configMounted.current) {
        window.ReactWidgets['DataPointConfiguration']?.unmount(CONFIG_ID);
      }
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
        <p>
          Append <code>?token=YOUR_SSO_TOKEN</code> to the URL to authenticate.
        </p>
        <p>
          Generate an SSO token from your{' '}
          <strong>IOsense portal → Profile → Generate SSO Token</strong>.
        </p>
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
        .app-preview__config {
          flex: 0 0 35%;
          min-width: 280px;
        }
        .app-preview__widget {
          flex: 1;
          min-width: 0;
        }
      `}</style>
    </div>
  );
}
