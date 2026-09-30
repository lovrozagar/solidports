import { For } from 'solid-js';
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
