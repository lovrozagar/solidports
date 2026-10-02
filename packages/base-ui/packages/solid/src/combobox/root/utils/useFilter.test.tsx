import { expect, describe, it } from 'vitest';
import { createSignal } from 'solid-js';
import { act, createRenderer } from '#test-utils';
import { screen } from '@solidjs/testing-library';
import { useComboboxFilter } from './useFilter';

describe('useComboboxFilter', () => {
  const { render } = createRenderer();

  it('uses default options when called without arguments', () => {
    function TestFilter() {
      const filter = useComboboxFilter();
      return <span>{String(filter.contains('Apple', 'app'))}</span>;
    }

    render(TestFilter);

    expect(screen.getByText('true')).not.toBe(null);
  });

  it('filters selected and unselected items in single and multiple modes', () => {
    const [multiple, setMultiple] = createSignal(false);

    function TestFilter(props: { multiple: boolean }) {
      const filter = useComboboxFilter({
        locale: 'en',
        get multiple() {
          return props.multiple;
        },
        value: 'Apple',
      });
      return (
        <div>
          <span data-testid="selected-match">{String(filter.contains('Banana', 'apple'))}</span>
          <span data-testid="item-match">{String(filter.contains('Banana', 'nan'))}</span>
        </div>
      );
    }

    render(() => <TestFilter multiple={multiple()} />);

    expect(screen.getByTestId('selected-match')).toHaveTextContent('true');
    expect(screen.getByTestId('item-match')).toHaveTextContent('true');

    act(() => setMultiple(true));

    expect(screen.getByTestId('selected-match')).toHaveTextContent('false');
    expect(screen.getByTestId('item-match')).toHaveTextContent('true');
  });
});
