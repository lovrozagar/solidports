

import { Toast } from '@solidports/base-ui/toast';
import styles from './index.module.css';

export default function PromiseToastExample() {
  return (
    <Toast.Provider>
      <PromiseDemo />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function PromiseDemo() {
  const toastManager = Toast.useToastManager();

  function runPromise() {
    toastManager.promise(
      // Simulate an API request with a promise that resolves after 2 seconds
      new Promise<string>((resolve, reject) => {
        const shouldSucceed = Math.random() > 0.3; // 70% success rate
        setTimeout(() => {
          if (shouldSucceed) {
            resolve('operation completed');
          } else {
            reject(new Error('operation failed'));
          }
        }, 2000);
      }),
      {
        loading: 'Loading data…',
        success: (data: string) => `Success: ${data}`,
        error: (err: Error) => `Error: ${err.message}`,
      },
    );
  }

  return (
    <button type="button" onClick={runPromise} class={styles.Button}>
      Run promise
    </button>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts().map((toast) => (
    <Toast.Root key={toast.id} toast={toast} class={styles.Toast}>
      <Toast.Content class={styles.Content}>
        <div class={styles.Text}>
          <Toast.Title class={styles.Title} />
          <Toast.Description class={styles.Description} />
        </div>
        <Toast.Close class={styles.Close}>Dismiss</Toast.Close>
      </Toast.Content>
    </Toast.Root>
  ));
}
