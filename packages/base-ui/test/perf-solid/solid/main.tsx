import { createComponent, flush } from 'solid-js';
import { render } from '@solidjs/web';
import { installHarness } from '../shared/harness';
import { setters } from './exposed';

// Every `fixtures/*.tsx` exports `fixtures: Record<key, Component>`.
const modules = import.meta.glob<{ fixtures: Record<string, () => unknown> }>('./fixtures/*.tsx', {
  eager: true,
});
const fixtures: Record<string, () => unknown> = Object.assign(
  {},
  ...Object.values(modules).map((module) => module.fixtures),
);

const container = document.getElementById('root')!;
let dispose: (() => void) | null = null;

installHarness({
  name: 'solid',
  mount(key) {
    const Fixture = fixtures[key];
    if (!Fixture) throw new Error(`No Solid fixture ${key}`);
    dispose = render(() => createComponent(Fixture as () => any, {}), container);
    flush();
  },
  unmount() {
    dispose!();
    dispose = null;
    flush();
  },
  set(key, value) {
    setters[key](value);
    flush();
  },
  flush() {
    flush();
  },
});
