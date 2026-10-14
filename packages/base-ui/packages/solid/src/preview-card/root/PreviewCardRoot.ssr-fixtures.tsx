import { PreviewCard } from '@solidports/base-ui/preview-card';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  renderTrigger: () => (
    <PreviewCard.Root>
      <PreviewCard.Trigger
        data-testid="trigger"
        render={(props) => (
          <a href="#preview" {...props}>
            Open
          </a>
        )}
      />
      <PreviewCard.Portal>
        <PreviewCard.Positioner>
          <PreviewCard.Popup>Content</PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  ),
  plainTrigger: () => (
    <PreviewCard.Root>
      <PreviewCard.Trigger data-testid="trigger">Open</PreviewCard.Trigger>
    </PreviewCard.Root>
  ),
});
