import { renderToString } from '@solidjs/web';
import { Collapsible } from '@solidports/base-ui/collapsible';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '../floor/collapsible';

/** Collapsible and its hand-written floor, server-rendered. */
export function renderPart(open: boolean) {
  return renderToString(() => (
    <Collapsible.Root defaultOpen={open}>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ));
}

export function renderFloor(open: boolean) {
  return renderToString(() => (
    <FloorCollapsibleRoot defaultOpen={open}>
      <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
      <FloorCollapsiblePanel>Content</FloorCollapsiblePanel>
    </FloorCollapsibleRoot>
  ));
}
