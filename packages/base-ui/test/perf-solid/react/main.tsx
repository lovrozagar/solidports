import * as React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
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
let root: Root | null = null;

installHarness({
  name: 'react',
  mount(key) {
    const Fixture = fixtures[key];
    if (!Fixture) throw new Error(`No React fixture ${key}`);
    root = createRoot(container);
    flushSync(() => root!.render(<Fixture />));
  },
  unmount() {
    flushSync(() => root!.unmount());
    root = null;
  },
  set(key, value) {
    flushSync(() => setters[key](value));
  },
  flush() {},
});
