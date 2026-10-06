import { createRenderEffect, createRoot, createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
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
