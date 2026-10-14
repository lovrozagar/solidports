import { Dialog } from '@solidports/base-ui/dialog';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  renderTrigger: () => (
    <Dialog.Root>
      <Dialog.Trigger
        data-testid="trigger"
        render={(props) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      />
      <Dialog.Portal>
        <Dialog.Popup>Content</Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  ),
  plainTrigger: () => (
    <Dialog.Root>
      <Dialog.Trigger data-testid="trigger">Open</Dialog.Trigger>
    </Dialog.Root>
  ),
});
