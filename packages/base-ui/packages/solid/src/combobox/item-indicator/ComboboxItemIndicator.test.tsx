import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderer, describeConformance, act } from '#test-utils';
import { Combobox } from '@solidports/base-ui/combobox';
import { createSignal } from 'solid-js';
import { expect, describe, it } from 'vitest';

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

  function TestComponent(props: { value: string; keepMounted?: boolean }) {
    return (
      <Combobox.Root value={props.value} open>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="a">
                  a
                  <Combobox.ItemIndicator keepMounted={props.keepMounted} data-testid="indicator" />
                </Combobox.Item>
                <Combobox.Item value="b">b</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    );
  }

  it('mounts only while selected when keepMounted is false', async () => {
    const [testProps, setTestProps] = createSignal<Parameters<typeof TestComponent>[0]>({
      value: 'b',
    });
    const setProps = async (next: Partial<Parameters<typeof TestComponent>[0]>) =>
      act(async () => {
        await Promise.resolve();
        setTestProps((previous) => ({ ...previous, ...next }));
      });
    await render(() => <TestComponent {...testProps()} />);

    expect(screen.queryByTestId('indicator')).toBe(null);

    await setProps({ value: 'a' });

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');
    expect(indicator).toHaveAttribute('aria-hidden', 'true');
    expect(indicator).not.toHaveAttribute('selected');

    await setProps({ value: 'b' });

    expect(screen.queryByTestId('indicator')).toBe(null);

    await setProps({ value: 'a' });

    expect(screen.getByTestId('indicator')).toHaveAttribute('data-selected');
  });

  it('preserves the kept-mounted element across selection changes', async () => {
    const [testProps, setTestProps] = createSignal<Parameters<typeof TestComponent>[0]>({
      value: 'b',
      keepMounted: true,
    });
    const setProps = async (next: Partial<Parameters<typeof TestComponent>[0]>) =>
      act(async () => {
        await Promise.resolve();
        setTestProps((previous) => ({ ...previous, ...next }));
      });
    await render(() => <TestComponent {...testProps()} />);
    const indicator = screen.getByTestId('indicator');

    expect(indicator).not.toHaveAttribute('data-selected');

    await setProps({ value: 'a' });

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');

    await setProps({ value: 'b' });

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).not.toHaveAttribute('data-selected');
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });

    await setProps({ value: 'a' });

    expect(screen.getByTestId('indicator')).toBe(indicator);
    expect(indicator).toHaveAttribute('data-selected');
  });
});
