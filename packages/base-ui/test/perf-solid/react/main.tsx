import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import { installHarness } from '../shared/harness';
import { setters } from './exposed';

// Every `fixtures/*.tsx` exports `fixtures: Record<key, Component>`.
const modules = import.meta.glob<{ fixtures: Record<string, React.FC> }>('./fixtures/*.tsx', {
  eager: true,
});
const fixtures: Record<string, React.FC> = Object.assign(
  {},
  ...Object.values(modules).map((module) => module.fixtures),
);

const container = document.getElementById('root')!;
let root: ReactDOMClient.Root | null = null;

installHarness({
  name: 'react',
  mount(key) {
    const Fixture = fixtures[key];
    if (!Fixture) {
      throw new Error(`No React fixture ${key}`);
    }
    root = ReactDOMClient.createRoot(container);
    ReactDOM.flushSync(() => root!.render(<Fixture />));
  },
  unmount() {
    ReactDOM.flushSync(() => root!.unmount());
    root = null;
  },
  set(key, value) {
    ReactDOM.flushSync(() => setters[key](value));
  },
  flush() {},
});
