import { createSignal, For } from 'solid-js';


import { Toast } from '@solidports/base-ui/toast';
import styles from './index.module.css';

export default function ExampleToast() {
  return (
    <Toast.Provider>
      <ToastButton />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function ToastButton() {
  const toastManager = Toast.useToastManager();
  const [count, setCount] = createSignal(0);

  function createToast() {
    setCount((prev) => prev + 1);
    toastManager.add({
      title: `Toast ${count() + 1} created`,
      description: 'This is a toast notification.',
    });
  }

  return (
    <button type="button" class={styles.Button} onClick={createToast}>
      Create toast
    </button>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <For each={toasts()}>
      {(toast) => (
    <Toast.Root toast={toast} swipeDirection="up" class={styles.Toast}>
      <Toast.Content class={styles.Content}>
        <div class={styles.Text}>
          <Toast.Title class={styles.Title} />
          <Toast.Description class={styles.Description} />
        </div>
        <Toast.Close class={styles.Close}>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  )}
    </For>
  );
}
