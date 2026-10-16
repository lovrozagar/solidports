import { renderToString } from '@solidjs/web';
import { Collapsible } from '@solidports/base-ui/collapsible';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '../floor/collapsible';

/** Collapsible and its hand-written floor, server-rendered `count` times side by side. */
export function renderPart(open: boolean, count = 1) {
  return renderToString(() =>
    Array.from({ length: count }, () => (
      <Collapsible.Root defaultOpen={open}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    )),
  );
}

export function renderFloor(open: boolean, count = 1) {
  return renderToString(() =>
    Array.from({ length: count }, () => (
      <FloorCollapsibleRoot defaultOpen={open}>
        <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
        <FloorCollapsiblePanel>Content</FloorCollapsiblePanel>
      </FloorCollapsibleRoot>
    )),
  );
}
