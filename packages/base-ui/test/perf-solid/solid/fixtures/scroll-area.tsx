import { For } from 'solid-js';
import { ScrollArea } from '@solidports/base-ui/scroll-area';
import { size } from '../../shared/sizes';
import { useExposed } from '../exposed';

function Rows() {
  const rows = useExposed('rows', size(1000));
  return (
    <ScrollArea.Root data-testid="scroll-root" style={{ width: '300px', height: '300px' }}>
      <ScrollArea.Viewport data-testid="viewport" style={{ height: '100%' }}>
        <ScrollArea.Content>
          <For each={Array.from({ length: rows() }, (_, i) => i)}>
            {(i) => (
              <div data-row="" style={{ height: '20px' }}>
                Row {i}
              </div>
            )}
          </For>
        </ScrollArea.Content>
      </ScrollArea.Viewport>
      <ScrollArea.Scrollbar data-testid="scrollbar" style={{ width: '10px' }}>
        <ScrollArea.Thumb data-testid="thumb" style={{ width: '100%' }} />
      </ScrollArea.Scrollbar>
    </ScrollArea.Root>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'scroll-area/rows': Rows,
};
