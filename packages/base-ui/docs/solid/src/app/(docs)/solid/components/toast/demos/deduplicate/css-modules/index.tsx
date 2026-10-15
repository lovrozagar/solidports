import { createMemo, For } from 'solid-js';
import { Toast } from '@solidports/base-ui/toast';
import styles from './index.module.css';

export default function PulseToast() {
  return (
    <Toast.Provider>
      <PulseToastButton />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}
function PulseToastButton() {
  const toastManager = Toast.useToastManager();
  function createToast() {
    toastManager.add({
      id: 'save-status',
      title: 'Draft saved',
      description: 'Click again while it is visible to replay the pulse.',
    });
  }
  return (
    <button type="button" onClick={createToast} class={styles.Button}>
      Save draft
    </button>
  );
}
function ToastList() {
  const _useToastManager = Toast.useToastManager();
  const { toasts } = _useToastManager;
  return (
    <>
      <For each={toasts()}>{(toast) => <PulseToastItem toast={toast} />}</For>
    </>
  );
}
function PulseToastItem(props: { toast: Toast.Root.ToastObject }) {
  const _render = createMemo(() => {
    let pulseClassName: string | null = null;

    // New toasts start with `updateKey: 0`, so the first add skips the replay pulse.
    if (props.toast.updateKey) {
      pulseClassName = props.toast.updateKey % 2 === 0 ? styles.PulseEven : styles.PulseOdd;
    }
    const className = [styles.Toast, pulseClassName].filter(Boolean).join(' ');
    return (
      <Toast.Root toast={props.toast} class={className}>
        <Toast.Content class={styles.Content}>
          <div class={styles.Text}>
            <Toast.Title class={styles.Title} />
            <Toast.Description class={styles.Description} />
          </div>
          <Toast.Close class={styles.Close}>Dismiss</Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
  return <>{_render()}</>;
}
