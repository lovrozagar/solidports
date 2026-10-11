import { createRoot, createSignal, flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { useUnmountAfterClose } from './useUnmountAfterClose';

describe('useUnmountAfterClose', () => {
  it('unmounts after close, ignores a second force, and drops a force that arrives while open', async () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useUnmountAfterClose> | undefined;
    let setOpen: (open: boolean) => void = () => {};
    const element = document.createElement('div');

    createRoot(() => {
      const [open, setOpenSignal] = createSignal(true, { ownedWrite: true });
      const [prevent, setPrevent] = createSignal(false, { ownedWrite: true });
      setOpen = setOpenSignal;
      api = useUnmountAfterClose({
        open,
        ref: () => element,
        preventUnmountOnClose: prevent,
        setPreventUnmountOnClose: (next) => {
          calls.push(`prevent:${next}`);
          setPrevent(next);
        },
        onUnmount: () => calls.push('unmount'),
        animateInitialOpen: true,
      });
    });
    flush();

    expect(api!.mounted()).toBe(true);
    expect(api!.transitionStatus()).toBe('starting');
    expect(api!.preventUnmountingOnClose()).toBe(false);

    api!.forceUnmount();
    setOpen(false);
    flush();
    expect(calls).toContain('unmount');

    const unmounts = calls.filter((call) => call === 'unmount').length;
    api!.forceUnmount();
    await Promise.resolve();
    expect(calls.filter((call) => call === 'unmount').length).toBe(unmounts);
  });

  it('keeps a prevented close mounted until forceUnmount, and ignores forceUnmount before mount', async () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useUnmountAfterClose> | undefined;
    let setOpen: (open: boolean) => void = () => {};
    let setPrevent: (prevent: boolean) => void = () => {};

    createRoot(() => {
      const [open, setOpenSignal] = createSignal(false, { ownedWrite: true });
      const [prevent, setPreventSignal] = createSignal(true, { ownedWrite: true });
      setOpen = setOpenSignal;
      setPrevent = setPreventSignal;
      api = useUnmountAfterClose({
        open,
        ref: () => null,
        preventUnmountOnClose: prevent,
        setPreventUnmountOnClose: setPreventSignal,
        onUnmount: () => calls.push('unmount'),
      });
    });
    flush();

    api!.forceUnmount();
    expect(calls).toEqual([]);
    expect(api!.preventUnmountingOnClose()).toBe(true);

    setOpen(true);
    flush();
    expect(api!.preventUnmountingOnClose()).toBe(false);

    setPrevent(true);
    setOpen(false);
    flush();
    expect(calls).toEqual([]);
    expect(api!.mounted()).toBe(true);

    api!.forceUnmount();
    await Promise.resolve();
    expect(calls).toEqual(['unmount']);
    expect(api!.mounted()).toBe(false);
  });

  it('drops a force that is still open on the next microtask, and applies one once close commits', async () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useUnmountAfterClose> | undefined;
    let setOpen: (open: boolean) => void = () => {};

    createRoot(() => {
      const [open, setOpenSignal] = createSignal(true, { ownedWrite: true });
      setOpen = setOpenSignal;
      api = useUnmountAfterClose({
        open,
        ref: () => null,
        preventUnmountOnClose: () => false,
        setPreventUnmountOnClose: () => {},
        onUnmount: () => calls.push('unmount'),
      });
    });
    flush();

    api!.forceUnmount();
    await Promise.resolve();
    expect(calls).toEqual([]);

    api!.forceUnmount();
    setOpen(false);
    flush();
    expect(calls).toEqual(['unmount']);
  });

  it('unmounts from the deferred force once close is visible to that microtask', async () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useUnmountAfterClose> | undefined;
    let openNow = true;

    createRoot(() => {
      api = useUnmountAfterClose({
        open: () => openNow,
        ref: () => null,
        preventUnmountOnClose: () => false,
        setPreventUnmountOnClose: () => {},
        onUnmount: () => calls.push('unmount'),
      });
    });
    flush();

    api!.forceUnmount();
    openNow = false;
    await Promise.resolve();
    expect(calls).toEqual(['unmount']);
  });

  it('ignores a deferred force that is still open, and a completion that lands after reopen', async () => {
    const calls: string[] = [];
    let api: ReturnType<typeof useUnmountAfterClose> | undefined;
    let setOpen: (open: boolean) => void = () => {};

    createRoot(() => {
      const [open, setOpenSignal] = createSignal(true, { ownedWrite: true });
      setOpen = setOpenSignal;
      api = useUnmountAfterClose({
        open,
        ref: () => document.createElement('div'),
        preventUnmountOnClose: () => false,
        setPreventUnmountOnClose: () => {},
        onUnmount: () => calls.push('unmount'),
      });
    });
    flush();

    api!.forceUnmount();
    setOpen(false);
    setOpen(true);
    flush();
    await Promise.resolve();
    expect(api!.mounted()).toBe(true);
  });

  it('ignores a closing animation that finishes after the popup has reopened', async () => {
    const previousAnimations = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    let resolveFinished = () => {};
    const finished = new Promise<void>((resolve) => {
      resolveFinished = resolve;
    });
    const element = document.createElement('div');
    let animationReads = 0;
    Object.defineProperty(element, 'getAnimations', {
      configurable: true,
      value: () => {
        animationReads += 1;
        return [
          {
            finished,
            effect: { getTiming: () => ({ duration: 1, iterations: 1 }) },
          },
        ];
      },
    });

    const calls: string[] = [];
    let api: ReturnType<typeof useUnmountAfterClose> | undefined;
    let setVersion: (version: number) => void = () => {};
    // `version` reruns the close effect. `openNow` is what the late callback reads, so a reopen
    // can land without aborting the callback that was already waiting on the animation.
    let openNow = true;

    try {
      createRoot(() => {
        const [version, setVersionSignal] = createSignal(0, { ownedWrite: true });
        setVersion = setVersionSignal;
        api = useUnmountAfterClose({
          open: () => {
            version();
            return openNow;
          },
          ref: () => element,
          preventUnmountOnClose: () => false,
          setPreventUnmountOnClose: () => {},
          onUnmount: () => calls.push('unmount'),
        });
      });
      flush();

      openNow = false;
      setVersion(1);
      flush();
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      expect(animationReads).toBeGreaterThan(0);
      expect(api!.mounted()).toBe(true);

      openNow = true;
      resolveFinished();
      await finished;
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      flush();
      expect(calls).toEqual([]);
      expect(api!.mounted()).toBe(true);
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = previousAnimations;
    }
  });
});
