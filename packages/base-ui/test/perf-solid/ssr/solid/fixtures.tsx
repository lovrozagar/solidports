import { For } from 'solid-js';
import { Dialog } from '@solidports/base-ui/dialog';
import { fixtures as basics } from '../../solid/fixtures/basics';
import { fixtures as popups } from '../../solid/fixtures/popups';
import { fixtures as forms } from '../../solid/fixtures/forms';

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

/** SSR fixtures, shared keys with `../react/fixtures.tsx`. */
export const ssrFixtures: Record<string, () => unknown> = {
  'select/1000': popups['select/1000'],
  'checkbox/1000': basics['checkbox/uncontrolled'],
  'dialog/page': DialogPage,
  'form/50': forms['form/50'],
  'accordion/300': basics['accordion/300'],
  'tabs/200': basics['tabs/200'],
};
