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

// Each toast with an action whose content comes from the toast's `actionProps` (D33 batch 3).
function ActionList() {
  const { toasts } = Toast.useToastManager();
  return (
    <For each={toasts()}>
      {(toast) => (
        <Toast.Root toast={toast} data-testid="toast">
          <Toast.Content>
            <Toast.Title data-testid="toast-title" />
            <Toast.Action data-testid="toast-action" />
            <Toast.Close>Dismiss</Toast.Close>
          </Toast.Content>
        </Toast.Root>
      )}
    </For>
  );
}

function ActionViewport() {
  return (
    <Toast.Provider toastManager={manager} timeout={0} limit={100}>
      <Toast.Portal>
        <Toast.Viewport
          data-testid="viewport"
          style={{ position: 'fixed', bottom: '10px', right: '10px', width: '300px' }}
        >
          <ActionList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

// Toasts anchored to a button, each with an arrow (D33 batch 3).
function AnchoredViewport() {
  const { toasts } = Toast.useToastManager();
  return (
    <>
      <button
        type="button"
        data-testid="toast-anchor"
        style={{ position: 'fixed', top: '200px', left: '200px', width: '80px', height: '20px' }}
      >
        Anchor
      </button>
      <Toast.Portal>
        <Toast.Viewport data-testid="viewport">
          <For each={toasts()}>
            {(toast) => (
              <Toast.Positioner toast={toast}>
                <Toast.Root toast={toast} data-testid="toast">
                  <Toast.Arrow data-testid="toast-arrow" />
                  <Toast.Title data-testid="toast-title" />
                </Toast.Root>
              </Toast.Positioner>
            )}
          </For>
        </Toast.Viewport>
      </Toast.Portal>
    </>
  );
}

function Anchored() {
  return (
    <Toast.Provider toastManager={manager} timeout={0} limit={100}>
      <AnchoredViewport />
    </Toast.Provider>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'toast/viewport': ToastViewport,
  'toast/viewport-action': ActionViewport,
  'toast/anchored': Anchored,
};
