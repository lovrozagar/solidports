import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSignal } from 'solid-js';
import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { useOpenChangeComplete } from './useOpenChangeComplete';

function Test(props: { open: () => boolean; onComplete: () => void }) {
  let element: HTMLDivElement | undefined;
  useOpenChangeComplete({
    open: props.open,
    ref: () => element,
    onComplete: () => props.onComplete(),
  });
  return (
    <div
      ref={(node) => {
        element = node;
      }}
    />
  );
}

describe('useOpenChangeComplete', () => {
  const { render } = createRenderer();

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not abort a run that completed when its owner is disposed', async () => {
    // A radio group's indicators: each one that closed keeps its completed run until unmount,
    // and aborting each one there cost radio/300's unmount about a millisecond.
    const abort = vi.spyOn(AbortController.prototype, 'abort');
    const onComplete = vi.fn();
    const [open, setOpen] = createSignal(true);
    const { unmount } = await render(() => <Test open={open} onComplete={onComplete} />);

    await act(async () => {
      setOpen(false);
      await flushMicrotasks();
    });
    expect(onComplete).toHaveBeenCalled();

    unmount();
    expect(abort).not.toHaveBeenCalled();
  });

  it('aborts a run that is still waiting when its owner is disposed', async () => {
    const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;
    // jsdom has no `getAnimations`: an animation that never finishes keeps the run waiting.
    Object.defineProperty(HTMLElement.prototype, 'getAnimations', {
      configurable: true,
      value: () => [
        {
          finished: new Promise(() => {}),
          effect: { getTiming: () => ({ duration: 1, iterations: 1 }) },
          pending: false,
          playState: 'running',
        },
      ],
    });
    try {
      const abort = vi.spyOn(AbortController.prototype, 'abort');
      const onComplete = vi.fn();
      const [open, setOpen] = createSignal(true);
      const { unmount } = await render(() => <Test open={open} onComplete={onComplete} />);
      await act(async () => {
        setOpen(false);
        await flushMicrotasks();
      });
      abort.mockClear();

      unmount();
      expect(onComplete).not.toHaveBeenCalled();
      expect(abort).toHaveBeenCalledTimes(1);
    } finally {
      delete (HTMLElement.prototype as { getAnimations?: unknown }).getAnimations;
      globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });
});
