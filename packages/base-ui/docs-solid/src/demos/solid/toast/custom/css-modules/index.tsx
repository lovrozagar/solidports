import type { JSX } from "solid-js";
import { For } from "solid-js";
import { Toast } from '@solidports/base-ui/toast';
import styles from './index.module.css';

interface CustomToastData {
  userId: string;
}

function isCustomToast(
  toast: Toast.Root.ToastObject,
): toast is Toast.Root.ToastObject<CustomToastData> {
  return toast.data?.userId !== undefined;
}

export default function CustomToastExample() {
  return (
    <Toast.Provider>
      <CustomToast />
      <Toast.Portal>
        <Toast.Viewport class={styles.Viewport}>
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

function CustomToast() {
  const toastManager = Toast.useToastManager();

  function action() {
    const data: CustomToastData = {
      userId: '123',
    };

    toastManager.add({
      title: 'Toast with custom data',
      data,
    });
  }

  return (
    <button type="button" onClick={action} class={styles.Button}>
      Create custom toast
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
        <Toast.Title class={styles.Title}>{toast.title}</Toast.Title>
        {isCustomToast(toast) && toast.data ? (
          <Toast.Description class={styles.Description}>
            `data.userId` is {toast.data.userId}
          </Toast.Description>
        ) : (
          <Toast.Description class={styles.Description} />
        )}
        <Toast.Close class={styles.Close} aria-label="Close">
          <XIcon class={styles.Icon} />
        </Toast.Close>
      </Toast.Content>
    </Toast.Root>
  )}
    </For>
  );}

function XIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}
