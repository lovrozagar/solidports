import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderer, describeConformance } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';

describe('<Combobox.ItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props) => <Combobox.ItemIndicator keepMounted {...props} ref={props.ref} />,
    () => ({
      refInstanceof: window.HTMLSpanElement,
      render(node, props) {
        return render(() => (
          <Combobox.Root>
            <Combobox.Item>{node(props!)}</Combobox.Item>
          </Combobox.Root>
        ));
      },
    }),
  );

  it('updates a mounted indicator when its item becomes unselected', async () => {
    const { user } = render(() => (
      <Combobox.Root defaultOpen defaultValue="apple">
        <Combobox.Input />
        <Combobox.Portal keepMounted>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple">
                  apple
                  <Combobox.ItemIndicator keepMounted data-testid="apple-indicator" />
                </Combobox.Item>
                <Combobox.Item value="banana">banana</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('apple-indicator')).toHaveAttribute('data-selected');

    await user.click(screen.getByRole('option', { name: 'banana' }));

    expect(screen.getByTestId('apple-indicator')).not.toHaveAttribute('data-selected');
  });

  it('renders the check for a selected item and nothing for an unselected one', () => {
    render(() => (
      <Combobox.Root defaultValue="apple">
        <Combobox.Item value="apple">
          apple
          <Combobox.ItemIndicator data-testid="selected" />
        </Combobox.Item>
        <Combobox.Item value="banana">
          banana
          <Combobox.ItemIndicator data-testid="unselected" />
        </Combobox.Item>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('selected').textContent).toBe('✔️');
    expect(screen.queryByTestId('unselected')).toBeNull();
  });

  it('renders custom indicator children instead of the check', () => {
    render(() => (
      <Combobox.Root defaultValue="apple">
        <Combobox.Item value="apple">
          apple
          <Combobox.ItemIndicator data-testid="selected">pick</Combobox.ItemIndicator>
        </Combobox.Item>
      </Combobox.Root>
    ));

    expect(screen.getByTestId('selected').textContent).toBe('pick');
  });
});
