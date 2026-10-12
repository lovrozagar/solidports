import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderer, describeConformance, act } from '#test-utils';
import { Select } from '@solidports/base-ui/select';
import { createSignal } from 'solid-js';
import { expect, describe, it } from 'vitest';

describe('<Select.ItemIndicator />', () => {
  const { render } = createRenderer();

  describeConformance(Select.ItemIndicator, () => ({
    refInstanceof: window.HTMLSpanElement,
    render(node, props) {
      return render(() => (
        <Select.Root open>
          <Select.Trigger>
            <Select.Value />
          </Select.Trigger>
          <Select.Positioner>
            <Select.Item>{node(props!)}</Select.Item>
          </Select.Positioner>
        </Select.Root>
      ));
    },
  }));

  it('settles out of its transition state after the item is deselected', async () => {
    const { user } = render(() => (
      <Select.Root multiple defaultOpen defaultValue={['a']}>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">
                a
                <Select.ItemIndicator keepMounted data-testid="indicator" />
              </Select.Item>
              <Select.Item value="b">b</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ));

    const indicator = screen.getByTestId('indicator');
    expect(indicator).toHaveAttribute('data-selected');

    await user.click(screen.getByRole('option', { name: 'a' }));

    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-selected');
    });

    // A kept-mounted indicator must not be left advertising an exit transition once the
    // deselection has finished, or `[data-ending-style]` CSS would stick permanently.
    await waitFor(() => {
      expect(indicator).not.toHaveAttribute('data-ending-style');
    });
  });

  it('renders the check for a selected item and nothing for an unselected one', () => {
    render(() => (
      <Select.Root open defaultValue="a">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Positioner>
          <Select.Item value="a">
            a
            <Select.ItemIndicator data-testid="selected" />
          </Select.Item>
          <Select.Item value="b">
            b
            <Select.ItemIndicator data-testid="unselected" />
          </Select.Item>
        </Select.Positioner>
      </Select.Root>
    ));

    expect(screen.getByTestId('selected').textContent).toBe('✔️');
    expect(screen.queryByTestId('unselected')).toBeNull();
  });

  it('renders custom indicator children instead of the check', () => {
    render(() => (
      <Select.Root open defaultValue="a">
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Positioner>
          <Select.Item value="a">
            a<Select.ItemIndicator data-testid="selected">pick</Select.ItemIndicator>
          </Select.Item>
        </Select.Positioner>
      </Select.Root>
    ));

    expect(screen.getByTestId('selected').textContent).toBe('pick');
  });

  function TestComponent(props: { value: string; keepMounted?: boolean }) {
    return (
      <Select.Root value={props.value} open>
        <Select.Trigger />
        <Select.Positioner>
          <Select.Popup>
            <Select.Item value="a">
              a
              <Select.ItemIndicator keepMounted={props.keepMounted} data-testid="indicator" />
            </Select.Item>
            <Select.Item value="b">b</Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Root>
    );
  }

  it('mounts only while selected when keepMounted is false', async () => {
    const [testProps, setTestProps] = createSignal<Parameters<typeof TestComponent>[0]>({
      value: 'b',
    });
    const setProps = async (next: Partial<Parameters<typeof TestComponent>[0]>) =>
      act(() => setTestProps((previous) => ({ ...previous, ...next })));
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
      act(() => setTestProps((previous) => ({ ...previous, ...next })));
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
