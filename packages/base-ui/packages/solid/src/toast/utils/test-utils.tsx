import { For } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { Toast } from '../index';

/**
 * @internal
 */
export function Button() {
  const { add } = Toast.useToastManager();
  return (
    <button
      type="button"
      onClick={() => {
        add({
          actionProps: {
            children: 'action',
            id: 'action',
          },
          description: 'description',
          title: 'title',
        });
      }}
    >
      add
    </button>
  );
}

/**
 * @internal
 */
export function List() {
  const { toasts } = Toast.useToastManager();

  return (
    <For each={toasts()}>
      {(toastItem) => (
        <Toast.Root toast={toastItem} data-testid="root">
          <Toast.Title data-testid="title" />
          <Toast.Description data-testid="description" />
          <Toast.Close aria-label="close-press" />
          <Toast.Action data-testid="action" />
        </Toast.Root>
      )}
    </For>
  );
}

/**
 * Solid: React Testing Library's `mouseEnter` also dispatches `mouseover`, which React turns into
 * `onMouseEnter` on every entered ancestor. The native event does not bubble, so enter the
 * viewport as well, as a browser does when the pointer reaches a toast.
 * @internal
 */
export function mouseEnterToast(element: HTMLElement) {
  const viewport = element.closest<HTMLElement>('[role="region"]');
  if (viewport && viewport !== element) {
    fireEvent.mouseEnter(viewport);
  }
  fireEvent.mouseEnter(element);
}

/**
 * Solid: the `mouseleave` counterpart of `mouseEnterToast`.
 * @internal
 */
export function mouseLeaveToast(element: HTMLElement) {
  fireEvent.mouseLeave(element);
  const viewport = element.closest<HTMLElement>('[role="region"]');
  if (viewport && viewport !== element) {
    fireEvent.mouseLeave(viewport);
  }
}
