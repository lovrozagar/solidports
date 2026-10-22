import { cleanup } from '@solidjs/testing-library';
import { configure } from '@testing-library/dom';
import { flush } from 'solid-js';
import { expect, vi } from 'vitest';
import { reset as resetErrorLog } from '../src/utils/error';
import { isSurfacedRenderError } from './createRenderer';
import { resetBrowserPointer } from './resetBrowserPointer';

let isCleaningUp = false;

/*
 * Desktop Firefox has no `Touch` or `TouchEvent` constructor, and desktop WebKit has both but
 * throws "Illegal constructor" from them, so the tests' `new Touch(...)` throws and testing-library
 * builds their touch events (`fireEvent.touchStart(el, { touches })`) as plain `Event`s without
 * their touch lists, and a touch handler reading `event.touches` throws. Provide the constructors
 * those tests need: a `Touch` with the fields of its init, and a `UIEvent` that carries the touch
 * lists of its init. Library code never detects `Touch` or `TouchEvent`.
 */
function isConstructible(create: () => unknown) {
  try {
    create();
    return true;
  } catch {
    return false;
  }
}

let touchPolyfilled = false;

if (
  typeof window !== 'undefined' &&
  !isConstructible(() => new window.Touch({ identifier: 0, target: document.body }))
) {
  touchPolyfilled = true;

  class Touch {
    declare readonly identifier: number;

    declare readonly target: EventTarget;

    declare readonly clientX: number;

    declare readonly clientY: number;

    declare readonly pageX: number;

    declare readonly pageY: number;

    declare readonly screenX: number;

    declare readonly screenY: number;

    declare readonly radiusX: number;

    declare readonly radiusY: number;

    declare readonly rotationAngle: number;

    declare readonly force: number;

    constructor(init: TouchInit) {
      this.identifier = init.identifier;
      this.target = init.target;
      this.clientX = init.clientX ?? 0;
      this.clientY = init.clientY ?? 0;
      this.pageX = init.pageX ?? this.clientX;
      this.pageY = init.pageY ?? this.clientY;
      this.screenX = init.screenX ?? 0;
      this.screenY = init.screenY ?? 0;
      this.radiusX = init.radiusX ?? 0;
      this.radiusY = init.radiusY ?? 0;
      this.rotationAngle = init.rotationAngle ?? 0;
      this.force = init.force ?? 0;
    }
  }
  (window as unknown as { Touch: unknown }).Touch = Touch;
}

// A native `TouchEvent` only accepts native `Touch` objects in its lists, so it is replaced with
// `Touch` too (WebKit constructs a `TouchEvent` but not a `Touch`).
if (
  typeof window !== 'undefined' &&
  (touchPolyfilled || !isConstructible(() => new window.TouchEvent('touchstart')))
) {
  class TouchEvent extends UIEvent {
    declare readonly touches: readonly Touch[];

    declare readonly targetTouches: readonly Touch[];

    declare readonly changedTouches: readonly Touch[];

    declare readonly altKey: boolean;

    declare readonly ctrlKey: boolean;

    declare readonly metaKey: boolean;

    declare readonly shiftKey: boolean;

    constructor(type: string, init: TouchEventInit = {}) {
      super(type, init);
      this.touches = init.touches ?? [];
      this.targetTouches = init.targetTouches ?? [];
      this.changedTouches = init.changedTouches ?? [];
      this.altKey = init.altKey ?? false;
      this.ctrlKey = init.ctrlKey ?? false;
      this.metaKey = init.metaKey ?? false;
      this.shiftKey = init.shiftKey ?? false;
    }
  }
  (window as unknown as { TouchEvent: unknown }).TouchEvent = TouchEvent;
}

/*
 * The shared jsdom setup replaces `requestAnimationFrame` with a `setTimeout` that returns 0, so
 * `cancelAnimationFrame` cannot cancel it. Browsers can: keep that, so a superseded frame callback
 * (a queued focus replaced by a newer one) does not run.
 */
if (typeof window !== 'undefined' && window.navigator.userAgent.includes('jsdom')) {
  const frames = new Map<number, ReturnType<typeof setTimeout>>();
  let lastFrameId = 0;
  globalThis.requestAnimationFrame = (callback) => {
    lastFrameId += 1;
    const frameId = lastFrameId;
    frames.set(
      frameId,
      setTimeout(() => {
        frames.delete(frameId);
        callback(0);
      }, 0),
    );
    return frameId;
  };
  globalThis.cancelAnimationFrame = (frameId) => {
    clearTimeout(frames.get(frameId));
    frames.delete(frameId);
  };
}

/*
 * Library code can dispatch an event from inside an effect (`element.focus()`; user-event
 * re-dispatches it through the wrapper below when the document lacks focus, as a parallel test
 * iframe does). Solid's queue is already running there, so the wrapper's `flush()` is a no-op and
 * Solid reports `FLUSH_IN_EFFECT_CALLBACK` about the harness, not the code under test. Drop only
 * that report, and only while the harness's own flush runs.
 */
let harnessFlushDepth = 0;

function flushAfterEvent() {
  harnessFlushDepth += 1;
  try {
    flush();
  } finally {
    harnessFlushDepth -= 1;
  }
}

/** Whether `message` is Solid's report about the harness's own flush, which the harness drops. */
function isHarnessFlushReport(message: string) {
  return harnessFlushDepth > 0 && message.startsWith('[FLUSH_IN_EFFECT_CALLBACK]');
}

// Registered after the shared setup's console check, so it wraps that check's `console.warn`.
beforeEach(() => {
  const warn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (isHarnessFlushReport(String(args[0] ?? ''))) {
      return;
    }
    warn(...args);
  };
  return () => {
    console.warn = warn;
  };
});

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
      flushAfterEvent();
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
  // The real Playwright cursor persists across test files in the same page. A file that drives it
  // (drag, CDP mouse events) leaves it wherever it stopped, and the next file's hover-opening
  // popups (tooltips, preview cards, hover menus) open when their trigger renders under it. Park it
  // before each file.
  beforeAll(resetBrowserPointer);

  // Within a file too: a test that drove the real pointer parks it again, and a pointer lock it
  // left (a scrub area requests one on pointerdown) is released, so the next test's real input
  // reaches the page. Only trusted events come from the real pointer.
  let drovePointer = false;
  window.addEventListener(
    'pointerdown',
    (event) => {
      if (event.isTrusted) {
        drovePointer = true;
      }
    },
    true,
  );
  window.addEventListener(
    'pointermove',
    (event) => {
      if (event.isTrusted) {
        drovePointer = true;
      }
    },
    true,
  );
  afterEach(async () => {
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
    if (drovePointer) {
      await resetBrowserPointer();
      // Parking moves the real pointer too.
      drovePointer = false;
    }
  });

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
  // SOLID_ATTRIBUTION=1 also enables the attribution engine `vite dev` runs (relayed/self-written
  // state, over-wide subscriptions), so a suite run inventories those diagnostics too.
  if (process.env.SOLID_ATTRIBUTION === '1') {
    const { attribution } = await import('solid-js/attribution');
    attribution.enable();
  }
  Error.stackTraceLimit = 60;
  const { appendFileSync } = await import('node:fs');
  beforeEach(() => {
    const original = console.warn;
    console.warn = (...args: unknown[]) => {
      const message = String(args[0] ?? '');
      // `FLUSH_IN_EFFECT_CALLBACK` is the harness's own: the event wrapper flushes after events, and an
      // effect can dispatch one (`element.focus()`).
      if (message.startsWith('[FLUSH_IN_EFFECT_CALLBACK]')) {
        return undefined;
      }
      if (/^\[[A-Z_]+\]/.test(message) && !/repair guide|deeper evidence/.test(message)) {
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
        // Recorded for the inventory, not failed per test.
        return undefined;
      }
      if (/^\[[A-Z_]+\] (repair guide|deeper evidence)/.test(message)) {
        return undefined;
      }
      return original(...args);
    };
  });
}

/*
 * The warning census (`warningCensus.ts`, plan 3 leaf 1.10): with `SOLID_WARNING_CENSUS` naming a
 * file, every `console.warn` and `console.error` a test logs is appended to it as JSONL with its
 * suite, test, code and origin. Registered last, so it wraps every filter above and records what
 * they drop. jsdom writes with Node's `fs`; browser mode sends each line to the Vitest server
 * (`appendWarningCensus` in `vitest.config.mts`). Not seen: messages logged outside a test,
 * and the ones a test asserts (`toWarnDev`, `toErrorDev` and `vi.spyOn(console, …)` replace the
 * console method for their span), which are expected behavior rather than noise.
 */
const censusFile = process.env.SOLID_WARNING_CENSUS;
if (censusFile) {
  const { createCensus } = await import('./warningCensus');
  let append: (line: string) => void;
  if (typeof window !== 'undefined' && !navigator.userAgent.includes('jsdom')) {
    const { commands } = await import('vitest/browser');
    const send = (
      commands as unknown as Record<string, (file: string, line: string) => Promise<void>>
    ).appendWarningCensus;
    append = (line) => void send(censusFile, line);
  } else {
    const { appendFileSync } = await import('node:fs');
    append = (line) => appendFileSync(censusFile, line);
  }
  const census = createCensus({
    target: console,
    write: (entry) => append(`${JSON.stringify(entry)}\n`),
    context: () => {
      const state = expect.getState();
      return {
        file: (state.testPath ?? '').replace(/^.*packages\/solid\//, ''),
        test: state.currentTestName ?? '',
      };
    },
    swallowed: isHarnessFlushReport,
  });
  beforeEach(() => census.install());
}

// Keyed selectors' writers push (D21): `createIdSelector`'s catch-all effect writes only for a change
// no writer pushed, a flush where the new id shows beside its stale membership. Any such write fails
// the test that made it; a test that makes them on purpose resets the counter itself.
afterEach(() => {
  const relays = (globalThis as { __baseUiIdSelectorRelays?: { writes: number } })
    .__baseUiIdSelectorRelays;
  if (relays !== undefined && relays.writes > 0) {
    const writes = relays.writes;
    relays.writes = 0;
    throw new Error(
      `createIdSelector's catch-all effect wrote ${writes} time(s): a writer of a keyed selector's current id does not push it.`,
    );
  }
});
