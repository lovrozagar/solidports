import { createRoot, createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { createLazyTransitionStatus } from './createLazyTransitionStatus';

describe('createLazyTransitionStatus', () => {
  // Every closed collapsible root and unchecked indicator holds one handle (plan 3, 48a): its
  // methods are shared, so a closed handle allocates no closure.
  it('holds no closures while closed', () => {
    createRoot((dispose) => {
      const closed = () => false;
      const a = createLazyTransitionStatus(closed);
      const b = createLazyTransitionStatus(() => false, { enableIdleState: true });
      expect(a.mounted).toBe(b.mounted);
      expect(a.transitionStatus).toBe(b.transitionStatus);
      expect(a.setMounted).toBe(b.setMounted);
      expect(a.mountedWhileClosed).toBe(b.mountedWhileClosed);
      // The only function it holds is the caller's `open`.
      expect(
        Object.values(a).filter((value) => typeof value === 'function' && value !== closed),
      ).toEqual([]);
      dispose();
    });
  });

  it('returns the closed values until the first open, then the status', () => {
    const { handle, setOpen, dispose } = createRoot((dispose) => {
      const [open, setOpen] = createSignal(false);
      return { handle: createLazyTransitionStatus(open), setOpen, dispose };
    });
    expect(handle.mounted()).toBe(false);
    expect(handle.mountedWhileClosed()).toBe(false);
    expect(handle.transitionStatus()).toBe(undefined);
    handle.setMounted(false);
    expect(handle.mounted()).toBe(false);
    setOpen(true);
    flush();
    expect(handle.mounted()).toBe(true);
    expect(handle.transitionStatus()).toBe('starting');
    dispose();
  });
});
