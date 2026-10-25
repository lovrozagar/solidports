/*
 * The work one more native Button mount does, counted, not timed: every invocation of a library
 * function per added button, read from V8's precise coverage (exact call counts, the same on every
 * run of the same code path). Moving Button from the pilot's hand-inlined renderer onto element.ts
 * cost +19% on button-1000's mount (3.10 to 3.70 ms) and 37 library calls per mount against the
 * pilot's 18 (19a77cb5): a renderer that does more per mount shows here as a count, where a timing
 * bench shows it as noise-bound milliseconds. Every native part on element.ts pays what Button pays.
 */
import { Session } from 'node:inspector/promises';
import { flush } from 'solid-js';
import { render } from '@solidjs/web';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@solidports/base-ui/button';

/** Library invocations per plain Button mount with the pilot renderer (19a77cb5). */
const PILOT_CALLS_PER_BUTTON = 18;
const LIBRARY = '/packages/solid/src/';

const session = new Session();
session.connect();

afterEach(() => {
  document.body.innerHTML = '';
});

/** Library function invocations mounting `count` plain buttons, by file and function. */
async function mountInvocations(count: number) {
  const container = document.createElement('div');
  document.body.append(container);
  await session.post('Profiler.enable');
  await session.post('Profiler.startPreciseCoverage', { callCount: true, detailed: false });
  // The first take returns the counters and zeroes them.
  await session.post('Profiler.takePreciseCoverage');
  const view = render(
    () => (
      <div>
        {Array.from({ length: count }, (_, i) => (
          <Button>Button {i}</Button>
        ))}
      </div>
    ),
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
        if (calls > 0 && fn.functionName) {
          const key = `${file}:${fn.functionName}`;
          counts.set(key, (counts.get(key) ?? 0) + calls);
        }
      }
    }
  }
  return counts;
}

describe('native Button mount work', () => {
  it('invokes no more library functions per mount than the pilot renderer', async () => {
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop -- warm-up, one mount at a time
      await mountInvocations(10);
    }
    const one = await mountInvocations(1);
    const many = await mountInvocations(11);
    const perButton: Record<string, number> = {};
    for (const [key, total] of many) {
      const each = (total - (one.get(key) ?? 0)) / 10;
      if (each !== 0) {
        perButton[key] = each;
      }
    }
    const total = Object.values(perButton).reduce((sum, n) => sum + n, 0);
    // The breakdown names what a regression added (`perButton`, by file and function).
    expect({ total, perButton }).toEqual({
      total: expect.toSatisfy((n: number) => n <= PILOT_CALLS_PER_BUTTON),
      perButton,
    });
  });
});
