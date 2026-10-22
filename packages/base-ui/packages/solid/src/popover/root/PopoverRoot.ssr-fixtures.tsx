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
  // Solid: server-rendered open, for the root's open-only machinery (D32's closed-root unit).
  defaultOpenTrigger: () => (
    <Popover.Root defaultOpen>
      <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
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
