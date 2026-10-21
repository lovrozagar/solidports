import { For } from 'solid-js';
import { Collapsible } from '@solidports/base-ui/collapsible';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '@solidports/base-ui-floor/collapsible';
import { fixtures as toggles } from '../../../solid/fixtures/toggles';
import { useExposed } from '../../../solid/exposed';
import { size } from '../../../shared/sizes';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** `collapsible/300` written as the hand-written Solid floor (`packages/solid/test/floor`). */
function FloorCollapsibles() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <FloorCollapsibleRoot open={open()}>
            <FloorCollapsibleTrigger>Trigger {i}</FloorCollapsibleTrigger>
            <FloorCollapsiblePanel>Panel {i}</FloorCollapsiblePanel>
          </FloorCollapsibleRoot>
        )}
      </For>
    </div>
  );
}

/** `collapsible/300` with every root open: the open panels' machinery and attributes. */
function CollapsiblesOpen() {
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Collapsible.Root open>
            <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
            <Collapsible.Panel>Panel {i}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

/** `collapsible/300-open` written as the hand-written Solid floor. */
function FloorCollapsiblesOpen() {
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <FloorCollapsibleRoot open>
            <FloorCollapsibleTrigger>Trigger {i}</FloorCollapsibleTrigger>
            <FloorCollapsiblePanel>Panel {i}</FloorCollapsiblePanel>
          </FloorCollapsibleRoot>
        )}
      </For>
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'collapsible/300': toggles['collapsible/300'],
  'collapsible/300-floor': FloorCollapsibles,
  'collapsible/300-open': CollapsiblesOpen,
  'collapsible/300-open-floor': FloorCollapsiblesOpen,
};
