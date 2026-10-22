/*
 * What a toast's height write re-runs (D32's fan-out gate): each toast's index and offset readers
 * subscribe to that toast's metadata only, so a height write re-runs the readers of the toasts
 * whose offset moved, and the number of computations it wakes does not grow with the toasts that
 * stay put.
 */
import { createRenderEffect, createRoot, DEV, flush, For, getOwner } from 'solid-js';
import { describe, expect, it, onTestFinished } from 'vitest';
import { Toast } from '@solidports/base-ui/toast';
import { createRenderer } from '#test-utils';
import { useToastProviderContext } from './provider/ToastProviderContext';
import type { ToastContext } from './provider/ToastProviderContext';
import { selectors } from './store';

/** The computations other than a probe's that read what `read` reads. */
function subscribers(read: () => void) {
  let probe: unknown;
  const dispose = createRoot((disposeRoot) => {
    createRenderEffect(
      () => {
        probe = getOwner();
        read();
      },
      () => {},
    );
    return disposeRoot;
  });
  onTestFinished(dispose);
  return () =>
    (DEV!.getSources(probe as never) as unknown[]).reduce<number>(
      (count, source) =>
        count +
        (DEV!.getObservers(source as never) as unknown[]).filter((observer) => observer !== probe)
          .length,
      0,
    );
}

describe('Toast: a height write re-runs only the toasts whose offset moved', () => {
  const { render } = createRenderer();

  function mountToasts(count: number) {
    const manager = Toast.createToastManager();
    let store!: ToastContext;
    function StoreProbe() {
      store = useToastProviderContext();
      return null;
    }
    function List() {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>
          {(toast) => (
            <Toast.Root toast={toast} data-testid="toast">
              <Toast.Title />
            </Toast.Root>
          )}
        </For>
      );
    }
    const view = render(() => (
      <Toast.Provider toastManager={manager} timeout={0} limit={count}>
        <StoreProbe />
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>
    ));
    for (let i = 0; i < count; i += 1) {
      manager.add({ id: `toast-${i}`, title: `Toast ${i}` });
    }
    flush();
    // Newest first: `toast-0` is the oldest and renders last.
    const offsetReaders = subscribers(() => selectors.toastOffsetY(store.state, () => 'toast-0'));
    const setHeight = (id: string, height: number) => {
      store.updateToastInternal(id, { height });
      flush();
    };
    const offsets = () =>
      Array.from(document.querySelectorAll<HTMLElement>('[data-testid="toast"]'), (element) =>
        element.style.getPropertyValue('--toast-offset-y'),
      );
    // Each toast's offset is the sum of the heights of the toasts above it (newest first).
    const expectedOffsets = () => {
      let offsetY = 0;
      return store.state.toasts.map((toast) => {
        const offset = `${offsetY}px`;
        offsetY += toast.height || 0;
        return offset;
      });
    };
    return { offsetReaders, setHeight, offsets, expectedOffsets, unmount: view.unmount };
  }

  it("subscribes a toast's offset readers to that toast only", async () => {
    const few = mountToasts(5);
    const fewReaders = few.offsetReaders();
    few.unmount();
    const many = mountToasts(40);
    expect(many.offsetReaders()).toBe(fewReaders);
  });

  it('moves the offsets below a toast whose height changed, and only those', async () => {
    const { setHeight, offsets, expectedOffsets } = mountToasts(4);
    expect(offsets()).toEqual(expectedOffsets());

    setHeight('toast-3', 40);
    const afterNewest = offsets();
    expect(afterNewest).toEqual(expectedOffsets());
    expect(afterNewest[1]).toBe('40px');

    setHeight('toast-1', 10);
    const afterSecondOldest = offsets();
    expect(afterSecondOldest).toEqual(expectedOffsets());
    expect(afterSecondOldest.slice(0, 3)).toEqual(afterNewest.slice(0, 3));

    setHeight('toast-0', 25);
    expect(offsets()).toEqual(afterSecondOldest);
  });

  it("keeps two providers' toasts apart on one page", async () => {
    const managers = [Toast.createToastManager(), Toast.createToastManager()];
    const stores: ToastContext[] = [];
    function StoreProbe() {
      stores.push(useToastProviderContext());
      return null;
    }
    function List(props: { name: string }) {
      const { toasts } = Toast.useToastManager();
      return (
        <For each={toasts()}>
          {(toast) => (
            <Toast.Root toast={toast} data-testid={props.name}>
              <Toast.Title />
            </Toast.Root>
          )}
        </For>
      );
    }
    render(() => (
      <>
        <For each={managers}>
          {(manager, index) => (
            <Toast.Provider toastManager={manager} timeout={0}>
              <StoreProbe />
              <Toast.Viewport>
                <List name={`toast-${index()}`} />
              </Toast.Viewport>
            </Toast.Provider>
          )}
        </For>
      </>
    ));
    // The same ids in both providers.
    for (const manager of managers) {
      manager.add({ id: 'b', title: 'B' });
      manager.add({ id: 'a', title: 'A' });
    }
    flush();
    const offsets = (name: string) =>
      Array.from(document.querySelectorAll<HTMLElement>(`[data-testid="${name}"]`), (element) =>
        element.style.getPropertyValue('--toast-offset-y'),
      );
    const before = offsets('toast-1');

    stores[0].updateToastInternal('a', { height: 33 });
    flush();

    expect(offsets('toast-0')[1]).toBe('33px');
    expect(offsets('toast-1')).toEqual(before);
    expect(selectors.toastOffsetY(stores[1].state, () => 'b')).toBe(
      stores[1].state.toasts[0].height || 0,
    );
  });
});
