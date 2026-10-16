import { For } from 'solid-js';
import { fixtures as toggles } from '../../../solid/fixtures/toggles';
import { useExposed } from '../../../solid/exposed';
import { size } from '../../../shared/sizes';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '../../../../../packages/solid/test/floor/collapsible';

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

export const fixtures: Record<string, () => unknown> = {
  'collapsible/300': toggles['collapsible/300'],
  'collapsible/300-floor': FloorCollapsibles,
};
