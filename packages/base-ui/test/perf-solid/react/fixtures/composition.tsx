import * as React from 'react';
import { DirectionProvider } from '@base-ui/react/direction-provider';
import { CSPProvider } from '@base-ui/react/csp-provider';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Toggle } from '@base-ui/react/toggle';
import { ScrollArea } from '@base-ui/react/scroll-area';
import { Popover } from '@base-ui/react/popover';
import { Dialog } from '@base-ui/react/dialog';
import { Select } from '@base-ui/react/select';
import { items, size } from '../../shared/sizes';
import { useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function Direction() {
  const direction = useExposed<'ltr' | 'rtl'>('direction', 'ltr');
  return (
    <div dir={direction} data-testid="dir">
      <DirectionProvider direction={direction}>
        <ToggleGroup>
          {range(size(500)).map((i) => (
            <Toggle key={i} value={`t${i}`}>
              T{i}
            </Toggle>
          ))}
        </ToggleGroup>
      </DirectionProvider>
    </div>
  );
}

function Csp() {
  return (
    <CSPProvider nonce="bench-nonce">
      {range(size(100)).map((i) => (
        <ScrollArea.Root key={i} style={{ height: '40px', width: '80px' }}>
          <ScrollArea.Viewport>
            <div style={{ height: '200px' }}>Content {i}</div>
          </ScrollArea.Viewport>
          <ScrollArea.Scrollbar>
            <ScrollArea.Thumb />
          </ScrollArea.Scrollbar>
        </ScrollArea.Root>
      ))}
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
                            {selectItems.map((it) => (
                              <Select.Item key={it.value} value={it.value}>
                                <Select.ItemText>{it.label}</Select.ItemText>
                              </Select.Item>
                            ))}
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
      {range(size(1000)).map((i) => (
        <Toggle
          key={i}
          render={(props, state) => (
            <button type="button" {...props}>
              {state.pressed ? 'on' : 'off'}
            </button>
          )}
        />
      ))}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'composition/direction': Direction,
  'composition/csp': Csp,
  'composition/nested-portals': NestedPortals,
  'composition/render-fn': RenderFn,
};
