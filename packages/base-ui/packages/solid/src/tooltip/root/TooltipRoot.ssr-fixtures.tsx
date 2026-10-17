import { Tooltip } from '@solidports/base-ui/tooltip';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  renderTrigger: () => (
    <Tooltip.Root>
      <Tooltip.Trigger
        data-testid="trigger"
        render={(props) => (
          <button type="button" {...props}>
            Open
          </button>
        )}
      />
      <Tooltip.Portal>
        <Tooltip.Positioner>
          <Tooltip.Popup>Content</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  ),
  plainTrigger: () => (
    <Tooltip.Root>
      <Tooltip.Trigger data-testid="trigger">Open</Tooltip.Trigger>
    </Tooltip.Root>
  ),
  openTriggers: () => (
    <Tooltip.Root defaultOpen>
      <Tooltip.Trigger data-testid="trigger">Open</Tooltip.Trigger>
      <Tooltip.Trigger>Other</Tooltip.Trigger>
    </Tooltip.Root>
  ),
});
