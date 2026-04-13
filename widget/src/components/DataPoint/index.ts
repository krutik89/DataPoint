import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import { DataPoint } from './DataPoint';
import type { WidgetConfig } from '../../iosense-sdk/types';

interface WidgetProps {
  config?: WidgetConfig;
  data: number | null;
  isLoading: boolean;
  error?: string;
}

const roots = new Map<string, ReturnType<typeof createRoot>>();

function mount(id: string, props: WidgetProps) {
  const container = document.getElementById(id);
  if (!container) return;
  container.setAttribute('data-zone-ignore', '');
  if (roots.has(id)) {
    roots.get(id)!.unmount();
    roots.delete(id);
  }
  const root = createRoot(container);
  roots.set(id, root);
  root.render(createElement(DataPoint, props));
}

function update(id: string, props: WidgetProps) {
  const root = roots.get(id);
  if (!root) return;
  root.render(createElement(DataPoint, props));
}

function unmount(id: string) {
  const root = roots.get(id);
  if (!root) return;
  root.unmount();
  roots.delete(id);
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ReactWidgets: Record<string, any>;
  }
}

window.ReactWidgets = window.ReactWidgets ?? {};
window.ReactWidgets['DataPoint'] = { mount, update, unmount };
