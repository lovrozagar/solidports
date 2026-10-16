import { renderToString } from '@solidjs/web';
import { Collapsible } from '@solidports/base-ui/collapsible';

/** Where this production server bundle resolves Solid's reactive core. */
export const signalsUrl = import.meta.resolve('@solidjs/signals');

/** A Collapsible with plain props: every part on the native path. */
export function renderCollapsible(open: boolean) {
  return renderToString(() => (
    <Collapsible.Root defaultOpen={open}>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));
}
