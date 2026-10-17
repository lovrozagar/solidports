import { createRenderEffect, createRoot, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetAnimationFrameScheduler } from './useAnimationFrame';
import { useTransitionStatus } from './useTransitionStatus';

describe('useTransitionStatus', () => {
  // A status created while already open (a lazily created instance, as a native panel's on its
  // first open) must enter `'starting'` with `animateInitialOpen`, for every option combination:
  // its frame effects are created eagerly in that case, and they read the status itself.
  describe.each([
    { enableIdleState: false, deferEndingState: false },
    { enableIdleState: true, deferEndingState: false },
    { enableIdleState: false, deferEndingState: true },
    { enableIdleState: true, deferEndingState: true },
  ])('created open with animateInitialOpen (%o)', ({ enableIdleState, deferEndingState }) => {
    it('enters starting without throwing', () => {
      createRoot((dispose) => {
        const [open] = createSignal(true);
        const status = useTransitionStatus(open, enableIdleState, deferEndingState, true);
        expect(status.mounted()).toBe(true);
        expect(status.transitionStatus()).toBe('starting');
        flush();
        expect(status.transitionStatus()).toBe('starting');
        dispose();
      });
    });

    it('enters starting when created from a tracking computation', () => {
      // The first read happens from a computation (an attribute effect's compute), as a part that
      // creates the status from a reader does.
      let status: ReturnType<typeof useTransitionStatus> | undefined;
      let seen: string | undefined;
      const dispose = createRoot((disposeRoot) => {
        const [open] = createSignal(true);
        const read = () => {
          status ??= useTransitionStatus(open, enableIdleState, deferEndingState, true);
          return status.transitionStatus();
        };
        createRenderEffect(read, (value) => {
          seen = value;
        });
        return disposeRoot;
      });
      flush();
      expect(seen).toBe('starting');
      expect(status!.transitionStatus()).toBe('starting');
      dispose();
    });
  });

  it('a status created closed keeps its closed values until it opens', () => {
    const [open, setOpen] = createSignal(false);
    let status: ReturnType<typeof useTransitionStatus> | undefined;
    const dispose = createRoot((disposeRoot) => {
      status = useTransitionStatus(open, true, true, true);
      return disposeRoot;
    });
    expect(status!.mounted()).toBe(false);
    expect(status!.transitionStatus()).toBe(undefined);
    setOpen(true);
    flush();
    expect(status!.mounted()).toBe(true);
    expect(status!.transitionStatus()).toBe('starting');
    dispose();
  });
});

// The frame that ends `'starting'` (plan 3 leaf 5.1.3): React styles `[data-starting-style]` for
// one painted frame, then sets the next status from a task after it. Every element that entered
// `'starting'` in one tick leaves it in one batch, so 300 panels opening at once cost one flush
// after the frame, not one each.
describe('the frame after starting', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetAnimationFrameScheduler();
  });

  // Fake frames and tasks; the shared frame scheduler starts fresh, so a frame an earlier test
  // requested from the real clock cannot hold this test's callbacks.
  const fakeFrames = () => {
    vi.useFakeTimers({
      toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'setTimeout', 'clearTimeout'],
    });
    resetAnimationFrameScheduler();
  };

  function instances(count: number, options: { idle?: boolean; deferEnding?: boolean } = {}) {
    const [open, setOpen] = createSignal(false);
    const statuses: ReturnType<typeof useTransitionStatus>[] = [];
    let reads = 0;
    const dispose = createRoot((disposeRoot) => {
      for (let i = 0; i < count; i += 1) {
        statuses.push(useTransitionStatus(open, options.idle ?? true, options.deferEnding ?? false));
      }
      // One reader of every status, as a list's parent tracks its rows.
      createRenderEffect(
        () => statuses.map((status) => status.transitionStatus()),
        () => {
          reads += 1;
        },
      );
      return disposeRoot;
    });
    flush();
    return { setOpen, statuses, reads: () => reads, dispose };
  }

  // As a browser between events: the flush, then the microtasks it queued and the flush they
  // need (an effect created in a flush applies on the next one).
  const settle = async () => {
    flush();
    await Promise.resolve();
    flush();
  };
  // The next timer only: the frame, then (a separate call) the task it queued.
  const frame = async () => {
    vi.advanceTimersToNextTimer();
    await settle();
  };
  const task = async () => {
    vi.advanceTimersToNextTimer();
    await settle();
  };

  it('keeps starting through the frame and leaves it in the task after it', async () => {
    fakeFrames();
    const { setOpen, statuses, dispose } = instances(1);
    setOpen(true);
    await settle();
    expect(statuses[0].transitionStatus()).toBe('starting');
    await frame();
    expect(statuses[0].transitionStatus()).toBe('starting');
    await task();
    expect(statuses[0].transitionStatus()).toBe('idle');
    dispose();
  });

  it('leaves starting in one batch for every element that entered it in one tick', async () => {
    fakeFrames();
    const { setOpen, statuses, reads, dispose } = instances(300);
    setOpen(true);
    await settle();
    const afterOpen = reads();
    await frame();
    // A browser runs each queued task on its own, with a flush after each: one task per element
    // would re-run the list's reader once per element. (Fake timers run them together.)
    expect(vi.getTimerCount(), 'tasks queued after the frame').toBe(1);
    await task();
    expect(statuses.every((status) => status.transitionStatus() === 'idle')).toBe(true);
    expect(reads() - afterOpen, 'reader re-runs after the frame').toBe(1);
    dispose();
  });

  it('writes nothing after a close that came before the frame', async () => {
    fakeFrames();
    const { setOpen, statuses, dispose } = instances(1, { idle: true });
    setOpen(true);
    flush();
    setOpen(false);
    flush();
    const closing = statuses[0].transitionStatus();
    await frame();
    await task();
    expect(statuses[0].transitionStatus()).toBe(closing);
    dispose();
  });

  it('schedules nothing for an open and a close in the same tick', async () => {
    fakeFrames();
    const { setOpen, statuses, dispose } = instances(1);
    setOpen(true);
    setOpen(false);
    flush();
    expect(statuses[0].transitionStatus()).toBe(undefined);
    await frame();
    await task();
    expect(statuses[0].transitionStatus()).toBe(undefined);
    expect(statuses[0].mounted()).toBe(false);
    dispose();
  });

  it('defers ending by one frame when asked', async () => {
    fakeFrames();
    const { setOpen, statuses, dispose } = instances(1, { deferEnding: true });
    setOpen(true);
    flush();
    await frame();
    await task();
    setOpen(false);
    flush();
    expect(statuses[0].transitionStatus()).not.toBe('ending');
    await frame();
    expect(statuses[0].transitionStatus()).toBe('ending');
    dispose();
  });

  it('writes nothing to an element disposed before its frame', async () => {
    fakeFrames();
    const { setOpen, statuses, dispose } = instances(1);
    setOpen(true);
    flush();
    const status = statuses[0];
    dispose();
    await frame();
    await task();
    expect(status.transitionStatus()).toBe('starting');
  });
});
