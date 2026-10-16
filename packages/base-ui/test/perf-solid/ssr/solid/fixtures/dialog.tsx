import { For } from 'solid-js';
import { Dialog } from '@solidports/base-ui/dialog';

const lines = Array.from({ length: 500 }, (_, i) => i);

// An open dialog with 500 nodes of content; its portal content mounts on the client.
function DialogPage() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Title>Dialog</Dialog.Title>
          <For each={lines}>{(i) => <p>Line {i}</p>}</For>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'dialog/page': DialogPage,
};
