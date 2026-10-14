import { expect, vi, describe, it } from 'vitest';
import { createRenderEffect, createSignal, lazy, Loading, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { fireEvent, screen } from '@solidjs/testing-library';
import { Toast } from '@solidports/base-ui/toast';
import { act, createRenderer, flushMicrotasks } from '#test-utils';
import { useToastProviderContext } from './ToastProviderContext';

describe('<Toast.Provider />', () => {
  const { clock, render } = createRenderer();

  clock.withFakeTimers();

  it('syncs a changed timeout before descendant layout effects', async () => {
    const onClose = vi.fn();

    function AddToastInLayoutEffect(props: { active: boolean }) {
      const { add } = Toast.useToastManager();

      createRenderEffect(
        () => props.active,
        (active) => {
          if (active) {
            add({ id: 'toast', title: 'Toast', onClose });
          }
        },
      );

      return null;
    }

    // Solid: React's `setProps` maps to signals read by the rendered tree.
    const [timeout, setTimeout] = createSignal(5000);
    const [addToast, setAddToast] = createSignal(false);

    await render(() => (
      <Toast.Provider timeout={timeout()}>
        <AddToastInLayoutEffect active={addToast()} />
      </Toast.Provider>
    ));

    await act(() => {
      setTimeout(1000);
      setAddToast(true);
    });

    clock.tick(999);
    await flushMicrotasks();
    expect(onClose).not.toHaveBeenCalled();

    clock.tick(2);
    await flushMicrotasks();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('syncs a changed limit before descendant layout effects', async () => {
    const observeToasts = vi.fn();

    function AddToastsInLayoutEffect(props: { active: boolean }) {
      const { add } = Toast.useToastManager();

      createRenderEffect(
        () => props.active,
        (active) => {
          if (active) {
            add({ id: 'first', title: 'First', timeout: 0 });
            add({ id: 'second', title: 'Second', timeout: 0 });
          }
        },
      );

      return null;
    }

    function ObserveToastsInLayoutEffect(props: { active: boolean }) {
      const store = useToastProviderContext();

      createRenderEffect(
        () => props.active,
        (active) => {
          if (active) {
            observeToasts(
              store.state.toasts.map((toast) => ({
                id: toast.id,
                limited: toast.limited,
              })),
            );
          }
        },
      );

      return null;
    }

    const [limit, setLimit] = createSignal(3);
    const [runEffects, setRunEffects] = createSignal(false);

    await render(() => (
      <Toast.Provider limit={limit()}>
        <AddToastsInLayoutEffect active={runEffects()} />
        <ObserveToastsInLayoutEffect active={runEffects()} />
      </Toast.Provider>
    ));

    await act(() => {
      setLimit(1);
      setRunEffects(true);
    });

    expect(observeToasts).toHaveBeenCalledWith([
      { id: 'second', limited: false },
      { id: 'first', limited: true },
    ]);
  });

  it('does not sync provider props from an abandoned render', async () => {
    // Solid: a never-resolving `lazy` child holds the update pending under `Loading`, the
    // counterpart of React's suspended transition render, which never commits.
    const onClose = vi.fn();
    const suspendedRender = vi.fn();
    const SuspendingChild = lazy(() => {
      suspendedRender();
      return new Promise<{ default: () => JSX.Element }>(() => {});
    });

    function AddToastButton() {
      const { add } = Toast.useToastManager();
      return (
        <button
          type="button"
          onClick={() => {
            add({ title: 'Toast', onClose });
          }}
        >
          Add toast
        </button>
      );
    }

    const [timeout, setTimeout] = createSignal(5000);
    const [suspend, setSuspend] = createSignal(false);

    await render(() => (
      <>
        <button
          type="button"
          onClick={() => {
            setTimeout(1000);
            setSuspend(true);
          }}
        >
          Start suspended update
        </button>
        <Loading fallback="Loading">
          <Toast.Provider timeout={timeout()}>
            <Show when={suspend()}>
              <SuspendingChild />
            </Show>
            <AddToastButton />
          </Toast.Provider>
        </Loading>
      </>
    ));

    fireEvent.click(screen.getByRole('button', { name: 'Start suspended update' }));
    await flushMicrotasks();
    expect(suspendedRender).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Add toast' }));

    clock.tick(1001);
    await flushMicrotasks();
    expect(onClose).not.toHaveBeenCalled();

    clock.tick(4000);
    await flushMicrotasks();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
