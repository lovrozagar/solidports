import { For } from 'solid-js';
import { Toast } from '@solidports/base-ui/toast';

const manager = Toast.createToastManager();
(window as unknown as { __benchToast: unknown }).__benchToast = manager;

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <For each={toasts()}>
      {(toast) => (
        <Toast.Root toast={toast} data-testid="toast">
          <Toast.Content>
            <Toast.Title data-testid="toast-title" />
            <Toast.Description />
            <Toast.Close>Dismiss</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}

function ToastViewport() {
  return (
    <Toast.Provider toastManager={manager} timeout={0} limit={100}>
      <Toast.Portal>
        <Toast.Viewport
          data-testid="viewport"
          style={{ position: 'fixed', bottom: '10px', right: '10px', width: '300px' }}
        >
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'toast/viewport': ToastViewport,
};
