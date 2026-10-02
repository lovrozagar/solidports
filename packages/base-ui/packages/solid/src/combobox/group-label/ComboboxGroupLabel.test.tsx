import { expect, describe, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { act, createRenderer, describeConformance } from '#test-utils';
import { createSignal, Show } from 'solid-js';
import { screen } from '@solidjs/testing-library';

describe('<Combobox.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(Combobox.GroupLabel, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Combobox.Root open>
          <Combobox.Group>{node(props!)}</Combobox.Group>
        </Combobox.Root>
      ));
    },
  }));

  describe('a11y attributes', () => {
    it('wires to group aria-labelledby', async () => {
      render(() => (
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>
                  <Combobox.GroupLabel>Label</Combobox.GroupLabel>
                </Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const group = screen.getByRole('group');
      const label = screen.getByText('Label');
      expect(group).toHaveAttribute('aria-labelledby', label.id);
    });

    it('is hidden from the accessibility tree by default', async () => {
      render(() => (
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>
                  <Combobox.GroupLabel>Label</Combobox.GroupLabel>
                </Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByText('Label')).toHaveAttribute('aria-hidden', 'true');
    });

    it('allows overriding aria-hidden', async () => {
      render(() => (
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>
                  <Combobox.GroupLabel aria-hidden={undefined}>Label</Combobox.GroupLabel>
                </Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      expect(screen.getByText('Label')).not.toHaveAttribute('aria-hidden');
    });

    it('uses provided id in aria-labelledby', async () => {
      render(() => (
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Group>
                  <Combobox.GroupLabel id="test-group">Label</Combobox.GroupLabel>
                </Combobox.Group>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'test-group');
    });

    it('does not let an older label cleanup clear a newer label', async () => {
      const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');

      function Test() {
        return (
          <Combobox.Root open>
            <Combobox.Group>
              <Show when={labels() !== 'new'}>
                <Combobox.GroupLabel id="old-label">Old</Combobox.GroupLabel>
              </Show>
              <Show when={labels() !== 'old'}>
                <Combobox.GroupLabel id="new-label">New</Combobox.GroupLabel>
              </Show>
            </Combobox.Group>
          </Combobox.Root>
        );
      }

      render(() => <Test />);

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-labelledby', 'old-label');

      act(() => setLabels('both'));
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');

      act(() => setLabels('new'));
      expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    });
  });
});
