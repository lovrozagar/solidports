import { createSignal } from 'solid-js';
import { expect, describe, it } from 'vitest';
import { Combobox } from '@solidports/base-ui/combobox';
import { createRenderer, describeConformance } from '#test-utils';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';

describe('<Combobox.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(Combobox.Popup, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => (
        <Combobox.Root open>
          <Combobox.Portal>
            <Combobox.Positioner>{node(props!)}</Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
    },
  }));

  it('exposes open state via data attributes mapping', async () => {
    render(() => (
      <Combobox.Root defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = await screen.findByTestId('popup');
    expect(popup).toHaveAttribute('data-open');
  });

  it('sets role to presentation when input renders outside the popup', async () => {
    render(() => (
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup" />
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'presentation');
    });
  });

  it('sets role to dialog when input renders inside the popup', async () => {
    render(() => (
      <Combobox.Root defaultOpen items={['Apple']}>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const popup = await screen.findByTestId('popup');
    await waitFor(() => {
      expect(popup).toHaveAttribute('role', 'dialog');
    });
  });

  it('focuses the popup instead of its input when opened by touch', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="popup">
              <Combobox.Input data-testid="input" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    fireEvent.pointerDown(trigger, { pointerType: 'touch' });
    fireEvent.mouseDown(trigger);

    await waitFor(() => {
      expect(screen.getByTestId('popup')).toHaveFocus();
    });
    expect(screen.getByTestId('input')).not.toHaveFocus();
  });

  it('honors initialFocus={false}', async () => {
    render(() => (
      <Combobox.Root>
        <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup initialFocus={false}>
              <Combobox.Input data-testid="input" />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    const trigger = screen.getByTestId('trigger');
    trigger.focus();
    fireEvent.click(trigger);

    await screen.findByTestId('input');
    expect(trigger).toHaveFocus();
  });

  it('returns focus to an explicitly provided element when the popup closes', async () => {
    function Test() {
      // Solid: `finalFocus` takes the element itself rather than a ref object.
      const [finalFocusElement, setFinalFocusElement] = createSignal<HTMLButtonElement>();
      return (
        <div>
          <button ref={setFinalFocusElement} type="button">
            final focus
          </button>
          <Combobox.Root defaultOpen>
            <Combobox.Input />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup finalFocus={finalFocusElement()}>
                  <Combobox.List>
                    <Combobox.Item value="a">a</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        </div>
      );
    }

    const { user } = render(() => <Test />);
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'final focus' })).toHaveFocus();
    });
  });
});
