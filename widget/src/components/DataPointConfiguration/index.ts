import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { DataPointConfiguration } from './DataPointConfiguration';
import type { WidgetConfig } from '../../iosense-sdk/types';

interface ConfigProps {
  config: WidgetConfig;
  authentication: string;
  onChange: (config: WidgetConfig) => void;
}

const roots = new Map<string, ReturnType<typeof createRoot>>();

function mount(id: string, props: ConfigProps) {
  const container = document.getElementById(id);
  if (!container) return;
  container.setAttribute('data-zone-ignore', '');
  if (roots.has(id)) {
    roots.get(id)!.unmount();
    roots.delete(id);
  }
  const root = createRoot(container);
  roots.set(id, root);
  root.render(createElement(DataPointConfiguration, props));
}

function update(id: string, props: ConfigProps) {
  const root = roots.get(id);
  if (!root) return;
  root.render(createElement(DataPointConfiguration, props));
}

function unmount(id: string) {
  const root = roots.get(id);
  if (!root) return;
  root.unmount();
  roots.delete(id);
}

declare global {
  interface Window {
    ReactWidgets: Record<
      string,
      { mount: typeof mount; update: typeof update; unmount: typeof unmount }
    >;
  }
}

window.ReactWidgets = window.ReactWidgets ?? {};
window.ReactWidgets['DataPointConfiguration'] = { mount, update, unmount };
