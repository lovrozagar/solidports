import { expect, vi, describe, it } from 'vitest';
import { createEffect, createRenderEffect, createSignal, Show, type Setter } from 'solid-js';
import { screen, waitFor } from '@solidjs/testing-library';
import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { useAnimationsFinished } from './useAnimationsFinished';

function createAnimation() {
  let resolveFinished!: () => void;
  let rejectFinished!: () => void;

  const finished = new Promise<void>((resolve, reject) => {
    resolveFinished = resolve;
    rejectFinished = reject;
  });

  return {
    animation: {
      finished,
      pending: false,
      playState: 'running',
    } as unknown as Animation,
    finish: resolveFinished,
    cancel: rejectFinished,
  };
}

interface TestProps {
  getAnimations: () => Animation[];
  onFinished: () => void;
  signal?: AbortSignal;
  batch?: boolean;
}

function Test(props: TestProps) {
  let element: HTMLDivElement | undefined;
  const runOnceAnimationsFinish = useAnimationsFinished(
    () => element,
    false,
    () => props.batch,
  );

  // Solid: a user effect runs after the `ref` is assigned, as React's layout effect.
  createEffect(
    () => props.getAnimations,
    (getAnimations) => {
      if (element) {
        element.getAnimations = getAnimations;
      }
    },
  );

  createEffect(
    () => ({ onFinished: props.onFinished, signal: props.signal }),
    ({ onFinished, signal }) => {
      runOnceAnimationsFinish(onFinished, signal ?? null);
    },
  );

  return (
    <div
      ref={(node) => {
        element = node;
      }}
    />
  );
}

describe('useAnimationsFinished', () => {
  const { render } = createRenderer();

  it('waits for a replacement animation after an animation is canceled', async () => {
    const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const initialAnimation = createAnimation();
    const replacementAnimation = createAnimation();
    const onFinished = vi.fn();
    let animations: Animation[] = [initialAnimation.animation];
    let getAnimationsCallCount = 0;

    try {
      await render(() => (
        <Test
          getAnimations={() => {
            getAnimationsCallCount += 1;
            return animations;
          }}
          onFinished={onFinished}
        />
      ));

      await waitFor(() => {
        expect(getAnimationsCallCount).toBeGreaterThan(0);
      });

      animations = [replacementAnimation.animation];

      await act(async () => {
        initialAnimation.cancel();
        await flushMicrotasks();
      });

      expect(onFinished).not.toHaveBeenCalled();

      animations = [];

      await act(async () => {
        replacementAnimation.finish();
        await flushMicrotasks();
      });

      expect(onFinished).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('finishes when a canceled animation has no replacement', async () => {
    const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const initialAnimation = createAnimation();
    const onFinished = vi.fn();
    let animations: Animation[] = [initialAnimation.animation];
    let getAnimationsCallCount = 0;

    try {
      await render(() => (
        <Test
          getAnimations={() => {
            getAnimationsCallCount += 1;
            return animations;
          }}
          onFinished={onFinished}
        />
      ));

      await waitFor(() => {
        expect(getAnimationsCallCount).toBeGreaterThan(0);
      });

      animations = [];

      await act(async () => {
        initialAnimation.cancel();
        await flushMicrotasks();
      });

      expect(onFinished).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('batches opted-in callbacks that finish in the same microtask into a single commit', async () => {
    const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const getAnimationsCallCounts = [0, 0];
    let commitCount = 0;

    function Item(props: {
      index: number;
      animation: Animation;
      mounted: boolean;
      setMounted: Setter<boolean>;
    }) {
      let element: HTMLDivElement | undefined;
      const runOnceAnimationsFinish = useAnimationsFinished(() => element, false, true);

      createEffect(
        () => undefined,
        () => {
          runOnceAnimationsFinish(() => props.setMounted(false));
        },
      );

      return (
        <Show when={props.mounted}>
          <div
            data-testid={`item-${props.index}`}
            ref={(node) => {
              element = node;
              node.getAnimations = () => {
                getAnimationsCallCounts[props.index] += 1;
                return [props.animation];
              };
            }}
          />
        </Show>
      );
    }

    // Solid: there is no Profiler; a render effect over both mounted states runs once per flush.
    const [firstMounted, setFirstMounted] = createSignal(true);
    const [secondMounted, setSecondMounted] = createSignal(true);

    function CommitCounter() {
      createRenderEffect(
        () => [firstMounted(), secondMounted()],
        () => {
          commitCount += 1;
        },
      );
      return null;
    }

    try {
      await render(() => (
        <>
          <CommitCounter />
          <Item
            index={0}
            animation={first.animation}
            mounted={firstMounted()}
            setMounted={setFirstMounted}
          />
          <Item
            index={1}
            animation={second.animation}
            mounted={secondMounted()}
            setMounted={setSecondMounted}
          />
        </>
      ));

      await waitFor(() => {
        expect(getAnimationsCallCounts[0]).toBeGreaterThan(0);
      });
      await waitFor(() => {
        expect(getAnimationsCallCounts[1]).toBeGreaterThan(0);
      });

      const commitCountBefore = commitCount;

      await act(async () => {
        first.finish();
        second.finish();
        await flushMicrotasks();
      });

      expect(screen.queryByTestId('item-0')).toBeNull();
      expect(screen.queryByTestId('item-1')).toBeNull();
      expect(commitCount).toBe(commitCountBefore + 1);
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('skips a callback whose signal aborts while the batch is flushing', async () => {
    const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const secondController = new AbortController();
    const onFirstFinished = vi.fn(() => secondController.abort());
    const onSecondFinished = vi.fn();
    const firstGetAnimations = vi.fn(() => [first.animation]);
    const secondGetAnimations = vi.fn(() => [second.animation]);

    try {
      await render(() => (
        <>
          <Test batch getAnimations={firstGetAnimations} onFinished={onFirstFinished} />
          <Test
            batch
            getAnimations={secondGetAnimations}
            onFinished={onSecondFinished}
            signal={secondController.signal}
          />
        </>
      ));

      await waitFor(() => {
        expect(firstGetAnimations).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(secondGetAnimations).toHaveBeenCalled();
      });

      await act(async () => {
        first.finish();
        second.finish();
        await flushMicrotasks();
      });

      expect(onFirstFinished).toHaveBeenCalledTimes(1);
      expect(onSecondFinished).not.toHaveBeenCalled();
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });

  it('commits each callback separately by default so later callbacks observe earlier updates', async () => {
    const animationsDisabled = globalThis.BASE_UI_ANIMATIONS_DISABLED;
    globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

    const first = createAnimation();
    const second = createAnimation();
    const firstGetAnimations = vi.fn(() => [first.animation]);
    const secondGetAnimations = vi.fn(() => [second.animation]);
    const onSecondUnmount = vi.fn();

    interface PopupProps {
      open: boolean;
      getAnimations: () => Animation[];
      onCloseComplete: () => void;
    }

    // Mirrors `useOpenChangeComplete`: the completion reads the latest `open` and only
    // unmounts while the popup is still closed.
    function Popup(props: PopupProps) {
      let element: HTMLDivElement | undefined;
      const runOnceAnimationsFinish = useAnimationsFinished(() => element);

      const onComplete = () => {
        if (!props.open) {
          props.onCloseComplete();
        }
      };

      // Solid: a user effect runs after the `ref` is assigned, as React's layout effect.
      createEffect(
        () => props.getAnimations,
        (getAnimations) => {
          if (element) {
            element.getAnimations = getAnimations;
          }
        },
      );

      createEffect(
        () => props.open,
        () => {
          const abortController = new AbortController();
          runOnceAnimationsFinish(onComplete, abortController.signal);
          return () => abortController.abort();
        },
      );

      return (
        <div
          ref={(node) => {
            element = node;
          }}
        />
      );
    }

    function App() {
      const [secondOpen, setSecondOpen] = createSignal(false);
      return (
        <>
          <Popup
            open={false}
            getAnimations={firstGetAnimations}
            onCloseComplete={() => setSecondOpen(true)}
          />
          <Popup
            open={secondOpen()}
            getAnimations={secondGetAnimations}
            onCloseComplete={onSecondUnmount}
          />
        </>
      );
    }

    try {
      await render(App);

      await waitFor(() => {
        expect(firstGetAnimations).toHaveBeenCalled();
      });
      await waitFor(() => {
        expect(secondGetAnimations).toHaveBeenCalled();
      });

      // Both popups are closing. The first popup's close completion reopens the second,
      // which must prevent the second popup's queued completion from unmounting it.
      await act(async () => {
        first.finish();
        second.finish();
        await flushMicrotasks();
      });

      expect(onSecondUnmount).not.toHaveBeenCalled();
    } finally {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = animationsDisabled;
    }
  });
});
