import { For } from 'solid-js';
import { DirectionProvider } from '@solidports/base-ui/direction-provider';
import { CSPProvider } from '@solidports/base-ui/csp-provider';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Toggle } from '@solidports/base-ui/toggle';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { Popover } from '@solidports/base-ui/popover';
import { Dialog } from '@solidports/base-ui/dialog';
import { Select } from '@solidports/base-ui/select';
import { items, size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Direction() {
  const direction = useExposed<'ltr' | 'rtl'>('direction', 'ltr');
  return (
    <div dir={direction()} data-testid="dir">
      <DirectionProvider direction={direction()}>
        <ToggleGroup>
          <For each={range(size(500))}>{(i) => <Toggle value={`t${i}`}>T{i}</Toggle>}</For>
        </ToggleGroup>
      </DirectionProvider>
    </div>
  );
}

function Csp() {
  return (
    <CSPProvider nonce="bench-nonce">
      <For each={range(size(100))}>
        {(i) => (
          <ScrollArea.Root style={{ height: '40px', width: '80px' }}>
            <ScrollArea.Viewport>
              <div style={{ height: '200px' }}>Content {i}</div>
            </ScrollArea.Viewport>
            <ScrollArea.Scrollbar>
              <ScrollArea.Thumb />
            </ScrollArea.Scrollbar>
          </ScrollArea.Root>
        )}
      </For>
    </CSPProvider>
  );
}

const selectItems = items(20);
function NestedPortals() {
  return (
    <Popover.Root>
      <Popover.Trigger data-testid="popover-trigger">Popover</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup data-testid="popover-popup">
            <Dialog.Root>
              <Dialog.Trigger data-testid="dialog-trigger">Dialog</Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Popup>
                  <Select.Root items={selectItems}>
                    <Select.Trigger data-testid="select-trigger">
                      <Select.Value placeholder="Pick" />
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner>
                        <Select.Popup>
                          <Select.List>
                            <For each={selectItems}>
                              {(it) => (
                                <Select.Item value={it.value}>
                                  <Select.ItemText>{it.label}</Select.ItemText>
                                </Select.Item>
                              )}
                            </For>
                          </Select.List>
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function RenderFn() {
  return (
    <div>
      <For each={range(size(1000))}>
        {() => (
          <Toggle
            render={(props, state) => (
              <button type="button" {...props}>
                {state.pressed ? 'on' : 'off'}
              </button>
            )}
          />
        )}
      </For>
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'composition/direction': Direction,
  'composition/csp': Csp,
  'composition/nested-portals': NestedPortals,
  'composition/render-fn': RenderFn,
};
