

import { Toast } from '@solidports/base-ui/toast';
import styles from './index.module.css';

export default function UndoToastExample() {
  return (
    <Toast.Provider>
      <Form />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function Form() {
  const toastManager = Toast.useToastManager();

  function action() {
    const id = toastManager.add({
      title: 'Action performed',
      description: 'You can undo this action.',
      type: 'success',
      timeout: 10000,
      actionProps: {
        children: 'Undo',
        onClick() {
          toastManager.close(id);
          toastManager.add({
            title: 'Action undone',
          });
        },
      },
    });
  }

  return (
    <button type="button" onClick={action} class={styles.Button}>
      Perform action
    </button>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts().map((toast) => (
    <Toast.Root key={toast.id} toast={toast} class={styles.Toast}>
      <Toast.Content class={styles.Content}>
        <div class={styles.Text}>
          <div class={styles.Message}>
            <Toast.Title class={styles.Title} />
            <Toast.Description class={styles.Description} />
          </div>
          <Toast.Action class={styles.UndoButton} />
        </div>
      </Toast.Content>
    </Toast.Root>
  ));
}
