import { createSignal, For } from 'solid-js';


import { Toast } from '@solidports/base-ui/toast';
import styles from './index.module.css';

export default function VaryingHeightsToast() {
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
    const description = TEXTS[Math.floor(Math.random() * TEXTS.length)];
    toastManager.add({
      title: `Toast ${count() + 1} created`,
      description,
    });
  }

  return (
    <button type="button" class={styles.Button} onClick={createToast}>
      Create varying height toast
    </button>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return (
    <For each={toasts()}>
      {(toast) => (
    <Toast.Root toast={toast} class={styles.Toast}>
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

const TEXTS = [
  'Short message.',
  'A bit longer message that spans two lines.',
  'This is a longer description that intentionally takes more vertical space to demonstrate stacking with varying heights.',
  'An even longer description that should span multiple lines so we can verify the clamped collapsed height and smooth expansion animation when hovering or focusing the viewport.',
];
