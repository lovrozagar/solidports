import { createSignal, Show } from 'solid-js';
import { expect, vi } from 'vitest';
import { act, createRenderer, describeConformance, flushMicrotasks } from '#test-utils';
import { Menu } from '@solidports/base-ui/menu';
import { screen } from '@solidjs/testing-library';
import { MenuGroupContext } from '../group/MenuGroupContext';

const testContext: MenuGroupContext = () => undefined;

describe('<Menu.GroupLabel />', () => {
  const { render } = createRenderer();

  describeConformance(Menu.GroupLabel, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node, props) =>
      render(() => <MenuGroupContext value={testContext}>{node(props!)}</MenuGroupContext>),
  }));

  it('throws when rendered outside Menu.Group or Menu.RadioGroup', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Solid: the dev runtime follows the uncaught render error with a console footer one microtask later.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      expect(() => render(() => <Menu.GroupLabel />)).to.throw(
        'Base UI: MenuGroupContext is missing. Menu group parts must be used within <Menu.Group> or <Menu.RadioGroup>.',
      );
      await flushMicrotasks();
    } finally {
      errorSpy.mockRestore();
      warnSpy.mockRestore();
    }
  });

  describe('a11y attributes', () => {
    it('is hidden from the accessibility tree by default', async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const groupLabel = screen.getByText('Test group');
      expect(groupLabel).to.have.attribute('aria-hidden', 'true');
    });

    it('allows overriding aria-hidden', async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel aria-hidden={undefined}>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const groupLabel = screen.getByText('Test group');
      expect(groupLabel).not.to.have.attribute('aria-hidden');
    });

    it("should reference the generated id in Group's `aria-labelledby`", async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const group = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(group).to.have.attribute('aria-labelledby', groupLabel.id);
    });

    it("should reference the provided id in Group's `aria-labelledby`", async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Menu.GroupLabel id="test-group">Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const group = screen.getByRole('group');
      expect(group).to.have.attribute('aria-labelledby', 'test-group');
    });

    it("should reference the generated id in RadioGroup's `aria-labelledby`", async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const radioGroup = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(radioGroup).to.have.attribute('aria-labelledby', groupLabel.id);
    });

    it("should reference the provided id in RadioGroup's `aria-labelledby`", async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.GroupLabel id="test-group">Test group</Menu.GroupLabel>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const radioGroup = screen.getByRole('group');
      expect(radioGroup).to.have.attribute('aria-labelledby', 'test-group');
    });

    it('should support GroupLabel when RadioGroup is rendered as Group', async () => {
      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group render={(props) => <Menu.RadioGroup {...props} />}>
                  <Menu.GroupLabel>Test group</Menu.GroupLabel>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const radioGroup = screen.getByRole('group');
      const groupLabel = screen.getByText('Test group');

      expect(radioGroup).to.have.attribute('aria-labelledby', groupLabel.id);
    });

    it('does not let an older label cleanup clear a newer label', async () => {
      const [labels, setLabels] = createSignal<'old' | 'both' | 'new'>('old');

      render(() => (
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Group>
                  <Show when={labels() !== 'new'}>
                    <Menu.GroupLabel id="old-label">Old</Menu.GroupLabel>
                  </Show>
                  <Show when={labels() !== 'old'}>
                    <Menu.GroupLabel id="new-label">New</Menu.GroupLabel>
                  </Show>
                </Menu.Group>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const group = screen.getByRole('group');
      expect(group).to.have.attribute('aria-labelledby', 'old-label');

      await act(() => setLabels('both'));
      expect(group).to.have.attribute('aria-labelledby', 'new-label');

      await act(() => setLabels('new'));
      expect(group).to.have.attribute('aria-labelledby', 'new-label');
    });
  });
});
