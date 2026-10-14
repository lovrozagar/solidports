import { Popover } from '@solidports/base-ui/popover';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  renderTrigger: () => (
    <Popover.Root>
      <Popover.Trigger
        data-testid="trigger"
        render={(props) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      />
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>Content</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  ),
  plainTrigger: () => (
    <Popover.Root>
      <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
    </Popover.Root>
  ),
});
