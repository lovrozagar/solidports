import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';

// An open dialog with 500 nodes of content; its portal content mounts on the client.
function DialogPage() {
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Trigger data-testid="dialog-trigger">Open dialog</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Popup>
          <Dialog.Title>Dialog</Dialog.Title>
          {Array.from({ length: 500 }, (_, i) => (
            <p key={i}>Line {i}</p>
          ))}
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export const fixtures: Record<string, React.FC> = {
  'dialog/page': DialogPage,
};
