import * as React from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { fixtures as basics } from '../../react/fixtures/basics';
import { fixtures as popups } from '../../react/fixtures/popups';
import { fixtures as forms } from '../../react/fixtures/forms';

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

/** SSR fixtures, shared keys with `../solid/fixtures.tsx`. */
export const ssrFixtures: Record<string, React.FC> = {
  'select/1000': popups['select/1000'],
  'checkbox/1000': basics['checkbox/uncontrolled'],
  'dialog/page': DialogPage,
  'form/50': forms['form/50'],
  'accordion/300': basics['accordion/300'],
  'tabs/200': basics['tabs/200'],
};
