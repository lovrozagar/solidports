import { createSignal } from 'solid-js';
import type { ComponentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { expect, vi, describe, beforeEach, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { createRenderer, describeConformance, resetBrowserPointer } from '#test-utils';
import { NOOP } from '../../utils/empty';
import * as FilterDropdown from '../../../test/filterDropdown';

describe('<FilterDropdown.Clear />', () => {
  beforeEach(resetBrowserPointer);

  const { render } = createRenderer();

  describeConformance(FilterDropdown.Clear, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node, props) {
      return render(() => (
        <ControlledFilterDropdownRoot initialValue="can">
          <FilterDropdown.Popup id={undefined}>
            <FilterDropdown.Input aria-label="Filter" />
            {node(props!)}
          </FilterDropdown.Popup>
        </ControlledFilterDropdownRoot>
      ));
    },
  }));

  it('does not render when the filter value is empty', async () => {
    render(() => (
      <ControlledFilterDropdownRoot>
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter" />
          <FilterDropdown.Clear data-testid="clear" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    expect(screen.queryByTestId('clear')).toBe(null);
  });

  it('clears the filter value and focuses the input when clicked', async () => {
    const onValueChange = vi.fn();
    const { user } = render(() => (
      <ControlledFilterDropdownRoot initialValue="can" onValueChange={onValueChange}>
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter countries' });
    await user.click(screen.getByLabelText('Clear filter'));

    expect(input).toHaveValue('');
    expect(input).toHaveFocus();
    expect(screen.queryByLabelText('Clear filter')).toBe(null);
    expect(onValueChange).toHaveBeenLastCalledWith(
      '',
      expect.objectContaining({ reason: 'clear-press' }),
    );
  });

  it('does nothing when disabled', async () => {
    const { user } = render(() => (
      <ControlledFilterDropdownRoot initialValue="can">
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear aria-label="Clear filter" disabled />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    const clear = screen.getByLabelText('Clear filter');
    expect(clear).toBeDisabled();

    await user.click(clear);

    expect(screen.getByRole('searchbox', { name: 'Filter countries' })).toHaveValue('can');
  });

  it('ignores a click on a disabled non-native button', async () => {
    const onValueChange = vi.fn();

    const { user } = render(() => (
      <ControlledFilterDropdownRoot initialValue="can" onValueChange={onValueChange}>
        <FilterDropdown.Popup id={undefined}>
          <FilterDropdown.Input aria-label="Filter countries" />
          <FilterDropdown.Clear
            aria-label="Clear filter"
            disabled
            nativeButton={false}
            render="div"
          />
        </FilterDropdown.Popup>
      </ControlledFilterDropdownRoot>
    ));

    await user.click(screen.getByLabelText('Clear filter'));

    expect(onValueChange).not.toHaveBeenCalled();
  });
});

interface ControlledFilterDropdownRootProps {
  children: JSX.Element;
  initialValue?: string;
  onValueChange?: ComponentProps<typeof FilterDropdown.Root>['onValueChange'];
}

function ControlledFilterDropdownRoot(props: ControlledFilterDropdownRootProps) {
  const [value, setValue] = createSignal(props.initialValue ?? '');
  const listRef = { current: [] as Array<HTMLElement | null> };

  return (
    <FilterDropdown.Root
      open
      value={value()}
      listRef={listRef}
      getActiveIndex={getNoActiveIndex}
      setActiveIndex={NOOP}
      onValueChange={(nextValue, eventDetails) => {
        props.onValueChange?.(nextValue, eventDetails);
        setValue(nextValue);
      }}
    >
      {props.children}
    </FilterDropdown.Root>
  );
}

function getNoActiveIndex() {
  return null;
}
