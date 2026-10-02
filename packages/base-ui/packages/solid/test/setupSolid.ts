import { cleanup } from '@solidjs/testing-library';
import { configure } from '@testing-library/dom';
import { flush } from 'solid-js';
import { vi } from 'vitest';
import { reset as resetErrorLog } from '../src/utils/error';
import { isSurfacedRenderError } from './createRenderer';

let isCleaningUp = false;

/*
 * React's harness wraps every testing-library event in `act()`. Solid 2 batches writes until the
 * next flush, so do the equivalent: flush after each dispatched event (fireEvent and user-event).
 * Not during teardown: a real browser fires blur/focusout synchronously while focused elements
 * are removed, and flushing inside the root's disposal re-runs half-disposed computations.
 */
configure({
  eventWrapper(callback) {
    const result = callback();
    if (!isCleaningUp) {
      flush();
    }
    return result;
  },
  async asyncWrapper(callback) {
    const result = await callback();
    flush();
    // As `@testing-library/react`'s wrapper: yield a macrotask before resolving, so work queued
    // by the interaction (timers, a pending frame) can run before the test continues.
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
      if (vi.isFakeTimers()) {
        vi.advanceTimersByTime(0);
      }
    });
    return result;
  },
});

/*
 * Start every test from an empty document. When the shared console check fails a test in its
 * afterEach, testing-library's own afterEach cleanup can be skipped, and the next test would
 * find the previous test's DOM.
 */
beforeEach(() => {
  cleanup();
});

// Auto-cleanup is disabled (test/disableAutoCleanup.ts) so teardown runs under the guard above.
afterEach(() => {
  isCleaningUp = true;
  try {
    cleanup();
  } finally {
    isCleaningUp = false;
  }
});

// The shared setup resets React's deduplicated error log; reset the Solid one as well.
afterEach(() => {
  resetErrorLog();
});

/*
 * In a real browser, a `waitFor` can resume inside a ResizeObserver delivery; observers the next
 * test creates there trip "ResizeObserver loop completed with undelivered notifications". Yield a
 * macrotask after each test so the delivery loop finishes first. Yield through a message, not a
 * timer: the next test would otherwise run nested in a timer callback, and Chromium clamps every
 * `setTimeout(0)` it schedules (user-event waits) to 4ms, which React's harness never does.
 */
if (!navigator.userAgent.includes('jsdom')) {
  afterEach(
    () =>
      new Promise<void>((resolve) => {
        const channel = new MessageChannel();
        channel.port1.onmessage = () => {
          channel.port1.close();
          resolve();
        };
        channel.port2.postMessage(null);
      }),
  );

  // A render error the test already received from `render` (e.g. "throws outside <X.Root>") is
  // also reported to `window` by the browser; that duplicate is not an unhandled error.
  window.addEventListener(
    'error',
    (event) => {
      if (isSurfacedRenderError(event.error)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );
}

/*
 * Diagnostics inventory (opt-in): with SOLID_DIAG_FILE set, record every Solid dev diagnostic
 * with its first library stack frames, so one suite run lists every site to fix.
 * SOLID_DIAG_FULL=1 records the whole stack (Solid internals included) instead.
 */
const diagFile = process.env.SOLID_DIAG_FILE;
if (diagFile) {
  const fullStack = process.env.SOLID_DIAG_FULL === '1';
  Error.stackTraceLimit = 60;
  const { appendFileSync } = await import('node:fs');
  beforeEach(() => {
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      const message = String(args[0] ?? '');
      if (/^\[[A-Z_]+\]/.test(message) && !/repair guide/.test(message)) {
        const frames = (new Error().stack ?? '').split('\n').slice(2);
        const libraryFrames = frames
          .filter(
            (line) =>
              /packages\/solid\/src\//.test(line) && !/solid-helpers|solid-1-compat/.test(line),
          )
          .slice(0, 6);
        const where = (fullStack || libraryFrames.length === 0 ? frames : libraryFrames)
          .map((line) =>
            line
              .trim()
              .replace(/.*packages\/solid\/src\//, '')
              .replace(/.*node_modules\//, '')
              .replace(/\)$/, ''),
          )
          .join(' < ');
        appendFileSync(diagFile, `${message.split('\n')[0].slice(0, 200)} @ ${where}\n`);
      }
      return original(...args);
    };
  });
}
