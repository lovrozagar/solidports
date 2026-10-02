import { expect, describe, it } from 'vitest';
import type { JSX } from '@solidjs/web';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Combobox } from '@solidports/base-ui/combobox';
import { Select } from '@solidports/base-ui/select';
import { screen } from '@solidjs/testing-library';
import { createRenderer, describeConformance } from '#test-utils';
import { ListboxSeparator } from './ListboxSeparator';

describe('<ListboxSeparator />', () => {
  const { render } = createRenderer();

  describeConformance(ListboxSeparator, () => ({
    render,
    refInstanceof: window.HTMLDivElement,
  }));

  it('has role="presentation" and defaults to horizontal', async () => {
    await render(() => <ListboxSeparator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).toHaveAttribute('role', 'presentation');
    expect(separator).toHaveAttribute('data-orientation', 'horizontal');
    expect(separator).not.toHaveAttribute('aria-orientation');
  });

  describe('prop: orientation', () => {
    ['horizontal', 'vertical'].forEach((orientation) => {
      it(orientation, async () => {
        await render(() => (
          <ListboxSeparator
            orientation={orientation as ListboxSeparator.Props['orientation']}
            data-testid="separator"
          />
        ));

        const separator = screen.getByTestId('separator');
        expect(separator).toHaveAttribute('data-orientation', orientation);
        expect(separator).not.toHaveAttribute('aria-orientation');
      });
    });
  });

  // Solid: elements are created inside the render scope, so each case renders through a thunk.
  describe.each<[string, () => JSX.Element]>([
    ['Autocomplete.Separator', () => <Autocomplete.Separator data-testid="separator" />],
    ['Combobox.Separator', () => <Combobox.Separator data-testid="separator" />],
    ['Select.Separator', () => <Select.Separator data-testid="separator" />],
  ])('%s', (_, separator) => {
    it('exposes the listbox separator behavior', async () => {
      await render(separator);

      const element = screen.getByTestId('separator');
      expect(element).toHaveAttribute('role', 'presentation');
      expect(element).toHaveAttribute('data-orientation', 'horizontal');
      expect(element).not.toHaveAttribute('aria-orientation');
    });
  });
});
