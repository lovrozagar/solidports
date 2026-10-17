/*
 * A hydrated native static part (Separator, the Progress and Meter Tracks and Indicators) claims
 * the server's element on the native path and follows its reactive inputs afterwards exactly as
 * the same tree rendered on the client does: after hydration and two updates, each part has the
 * client render's attributes.
 */
import { flush } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { createRenderer, expectNativePath } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures, {
  INITIAL,
  setIndeterminateValue,
  setMeterValue,
  setOrientation,
  setProgressValue,
} from './staticParts.ssr-fixtures';

type Name = keyof typeof fixtures.fixtures;

/** Each fixture's parts, its reset to the server's inputs, and the two updates after hydration. */
const TREES: Record<Name, { parts: string[]; reset: () => void; updates: (() => void)[] }> = {
  separators: {
    parts: ['separator-default', 'separator-literal', 'separator-reactive'],
    reset: () => setOrientation(INITIAL.orientation),
    updates: [() => setOrientation('vertical'), () => setOrientation('horizontal')],
  },
  progress: {
    parts: ['progress-track', 'progress-indicator'],
    reset: () => setProgressValue(INITIAL.progress),
    updates: [() => setProgressValue(100), () => setProgressValue(null)],
  },
  progressIndeterminate: {
    parts: ['progress-track', 'progress-indicator'],
    reset: () => setIndeterminateValue(INITIAL.indeterminate),
    updates: [() => setIndeterminateValue(10), () => setIndeterminateValue(100)],
  },
  meter: {
    parts: ['meter-track', 'meter-indicator'],
    reset: () => setMeterValue(INITIAL.meter),
    updates: [() => setMeterValue(80), () => setMeterValue(0)],
  },
};

/**
 * A style attribute as the CSSOM reads it, declarations sorted: the server prints a number as
 * written (`0`) where the client's CSSOM serializes its value (`0px`).
 */
function normalizeStyle(value: string) {
  const probe = document.createElement('div');
  probe.setAttribute('style', value);
  return probe.style.cssText
    .split(';')
    .map((declaration) => declaration.replace(/\s*:\s*/, ':').trim())
    .filter(Boolean)
    .sort()
    .join(';');
}

/** The part's attributes: names sorted, hydration keys left out, styles normalized. */
function attributesOf(testId: string) {
  const element = screen.getByTestId(testId);
  return Object.fromEntries(
    [...element.attributes]
      .filter(({ name }) => name !== '_hk')
      .map(({ name, value }) => [name, name === 'style' ? normalizeStyle(value) : value])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

/** Every part's attributes after the tree settles, then after each update. */
async function sequence(name: Name) {
  await Promise.resolve();
  flush();
  const parts = TREES[name].parts;
  for (const part of parts) {
    // A spread, say, would move a part to the slow path.
    expectNativePath(screen.getByTestId(part));
  }
  const states = [parts.map(attributesOf)];
  for (const update of TREES[name].updates) {
    update();
    flush();
    states.push(parts.map(attributesOf));
  }
  return states;
}

describe('a hydrated native static part', () => {
  const { render } = createRenderer();

  it.each(Object.keys(TREES) as Name[])(
    'follows its inputs as the client render does (%s)',
    async (name) => {
      TREES[name].reset();
      flush();
      const { hydrate } = renderServer(fixtures, name);
      const view = hydrate();
      const hydrated = await sequence(name);
      view.dispose();

      TREES[name].reset();
      flush();
      render(fixtures.fixtures[name]);
      const onTheClient = await sequence(name);

      expect(hydrated).toEqual(onTheClient);
      // The updates changed something: the comparison is not over three identical states.
      expect(new Set(hydrated.map((state) => JSON.stringify(state))).size).toBeGreaterThan(1);
    },
  );
});
