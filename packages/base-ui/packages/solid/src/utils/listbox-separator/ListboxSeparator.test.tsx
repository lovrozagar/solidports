import { createRenderer } from '#test-utils';
import { Autocomplete } from '@solidports/base-ui/autocomplete';
import { Combobox } from '@solidports/base-ui/combobox';
import { Select } from '@solidports/base-ui/select';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { ListboxSeparator } from './ListboxSeparator';

describe('<ListboxSeparator />', () => {
  const { render } = createRenderer();

  it('has role="presentation" and defaults to horizontal', () => {
    render(() => <ListboxSeparator data-testid="separator" />);

    const separator = screen.getByTestId('separator');
    expect(separator).to.have.attribute('role', 'presentation');
    expect(separator).to.have.attribute('data-orientation', 'horizontal');
    expect(separator).to.not.have.attribute('aria-orientation');
  });

  describe('prop: orientation', () => {
    (['horizontal', 'vertical'] as const).forEach((orientation) => {
      it(orientation, () => {
        render(() => <ListboxSeparator orientation={orientation} data-testid="separator" />);

        const separator = screen.getByTestId('separator');
        expect(separator).to.have.attribute('data-orientation', orientation);
        expect(separator).to.not.have.attribute('aria-orientation');
      });
    });
  });

  it('Autocomplete.Separator exposes the listbox separator behavior', () => {
    render(() => <Autocomplete.Separator data-testid="separator" />);
    const element = screen.getByTestId('separator');
    expect(element).to.have.attribute('role', 'presentation');
    expect(element).to.have.attribute('data-orientation', 'horizontal');
  });

  it('Combobox.Separator exposes the listbox separator behavior', () => {
    render(() => <Combobox.Separator data-testid="separator" />);
    const element = screen.getByTestId('separator');
    expect(element).to.have.attribute('role', 'presentation');
    expect(element).to.have.attribute('data-orientation', 'horizontal');
  });
});
