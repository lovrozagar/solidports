import * as React from 'react';
import { Toast } from '@base-ui/react/toast';

const manager = Toast.createToastManager();
(window as unknown as { __benchToast: unknown }).__benchToast = manager;

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} data-testid="toast">
      <Toast.Content>
        <Toast.Title data-testid="toast-title" />
        <Toast.Description />
        <Toast.Close>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
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
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} data-testid="toast">
      <Toast.Content>
        <Toast.Title data-testid="toast-title" />
        <Toast.Action data-testid="toast-action" />
        <Toast.Close>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
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
    <React.Fragment>
      <button
        type="button"
        data-testid="toast-anchor"
        style={{ position: 'fixed', top: '200px', left: '200px', width: '80px', height: '20px' }}
      >
        Anchor
      </button>
      <Toast.Portal>
        <Toast.Viewport data-testid="viewport">
          {toasts.map((toast) => (
            <Toast.Positioner key={toast.id} toast={toast}>
              <Toast.Root toast={toast} data-testid="toast">
                <Toast.Arrow data-testid="toast-arrow" />
                <Toast.Title data-testid="toast-title" />
              </Toast.Root>
            </Toast.Positioner>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </React.Fragment>
  );
}

function Anchored() {
  return (
    <Toast.Provider toastManager={manager} timeout={0} limit={100}>
      <AnchoredViewport />
    </Toast.Provider>
  );
}

// Each toast fades out over 60 ms when it closes: its removal waits for the exit to finish.
const EXIT_CSS =
  '.bench-toast-exit { transition: opacity 60ms linear; } .bench-toast-exit[data-ending-style] { opacity: 0; }';

function ExitList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => (
    <Toast.Root key={toast.id} toast={toast} data-testid="toast" className="bench-toast-exit">
      <Toast.Title data-testid="toast-title" />
    </Toast.Root>
  ));
}

function ExitViewport() {
  return (
    <Toast.Provider toastManager={manager} timeout={0} limit={100}>
      <style>{EXIT_CSS}</style>
      <Toast.Portal>
        <Toast.Viewport data-testid="viewport">
          <ExitList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

export const fixtures: Record<string, React.FC> = {
  'toast/viewport': ToastViewport,
  'toast/viewport-action': ActionViewport,
  'toast/anchored': Anchored,
  'toast/viewport-exit': ExitViewport,
};
