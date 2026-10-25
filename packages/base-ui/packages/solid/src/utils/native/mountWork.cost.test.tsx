/*
 * The work one more native part mount does, counted, not timed: every library function invocation
 * per added copy, named or anonymous (a closure counts by its source offset), read from V8's
 * precise coverage (exact call counts, the same on every run of the same code path). A renderer
 * that does more per mount shows here as a count, where a timing bench shows it as noise-bound
 * milliseconds; every native part on element.ts pays what its renderer pays. Moving Button from
 * the pilot's hand-inlined renderer onto element.ts cost +19% on button-1000's mount (3.10 to 3.70
 * ms), and a Button mount more calls than the pilot's, which the renderer's fast paths took back.
 * The counts are a growth guard; nodes and heap are the hard bar, and the paired mount timing
 * decides a renderer move.
 */
import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { isJSDOM } from '#test-utils';
import { Button } from '@solidports/base-ui/button';
import { Toggle } from '@solidports/base-ui/toggle';

/**
 * Each part's mount, and its budget: the library invocations one more copy made on the renderer it
 * left, or lower (Button: the pilot's 35 at 19a77cb5, 33 once a write-once element keeps no writer),
 * or on element.ts where its writer's per-element structure
 * costs a few more than the old renderer's closure pair (Toggle: 86 on index.ts at 244b3d6d, 90
 * here; the paired mount timing decides).
 */
const CASES: Record<string, { budget: number; render: (i: number) => JSX.Element }> = {
  Button: { budget: 33, render: (i) => <Button>Button {i}</Button> },
  Toggle: { budget: 90, render: (i) => <Toggle>Toggle {i}</Toggle> },
};
const LIBRARY = ['', 'packages', 'solid', 'src', ''].join('/');

/** Node's inspector session, which only the jsdom run has (a browser run has no V8 coverage here). */
type InspectorSession = {
  connect(): void;
  post(method: string, params?: object): Promise<any>;
};
let session: InspectorSession;
// Not a literal, so a browser run's bundler leaves the import alone.
const INSPECTOR = ['node', 'inspector/promises'].join(':');

afterEach(() => {
  document.body.innerHTML = '';
});

/** Library function invocations mounting `count` copies of a part, by file and function. */
async function mountInvocations(part: (i: number) => JSX.Element, count: number) {
  const container = document.createElement('div');
  document.body.append(container);
  await session.post('Profiler.enable');
  await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  // The first take returns the counters and zeroes them.
  await session.post('Profiler.takePreciseCoverage');
  const view = render(
    () => <div>{Array.from({ length: count }, (_, i) => part(i))}</div>,
    container,
  );
  flush();
  const { result } = await session.post('Profiler.takePreciseCoverage');
  await session.post('Profiler.stopPreciseCoverage');
  view();
  container.remove();
  const counts = new Map<string, number>();
  for (const script of result) {
    const at = script.url.indexOf(LIBRARY);
    const file = at < 0 ? '' : script.url.slice(at + LIBRARY.length);
    if (file !== '' && !file.includes('.test.')) {
      for (const fn of script.functions) {
        const calls = fn.ranges[0].count;
        if (calls > 0) {
          // Anonymous functions (closures, arrow callbacks) count too, by their source offset.
          const key = `${file}:${fn.functionName || `<anonymous@${fn.ranges[0].startOffset}>`}`;
          counts.set(key, (counts.get(key) ?? 0) + calls);
        }
      }
    }
  }
  return counts;
}

// jsdom only: the counts come from Node's inspector.
describe.skipIf(!isJSDOM)('native part mount work', () => {
  beforeAll(async () => {
    const { Session } = await import(/* @vite-ignore */ INSPECTOR);
    session = new Session() as InspectorSession;
    session.connect();
  });

  it.each(Object.keys(CASES))(
    'a plain %s invokes no more library functions per mount than the renderer it left',
    async (name) => {
      const { budget, render: part } = CASES[name];
      for (let i = 0; i < 5; i += 1) {
        // eslint-disable-next-line no-await-in-loop -- warm-up, one mount at a time
        await mountInvocations(part, 10);
      }
      const one = await mountInvocations(part, 1);
      const many = await mountInvocations(part, 11);
      const perCopy: Record<string, number> = {};
      for (const [key, total] of many) {
        const each = (total - (one.get(key) ?? 0)) / 10;
        if (each !== 0) {
          perCopy[key] = each;
        }
      }
      const total = Object.values(perCopy).reduce((sum, n) => sum + n, 0);
      // The breakdown names what a regression added (`perCopy`, by file and function).
      expect({ total, perCopy }).toEqual({
        total: expect.toSatisfy((n: number) => n <= budget),
        perCopy,
      });
    },
  );
});
