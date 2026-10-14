import { expect, describe, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { Menu } from '@solidports/base-ui/menu';
import { createRenderer } from '#test-utils';

/*
 * Solid: a filterable item resolves its children once, to read their text. They must resolve under
 * the item's own context, as an unfiltered item's do: an indicator reads its item's context.
 */
function Items() {
  return (
    <>
      <Menu.Input aria-label="Filter" />
      <Menu.Empty>No matches</Menu.Empty>
      <Menu.List>
        <Menu.CheckboxItem defaultChecked>
          <Menu.CheckboxItemIndicator data-testid="checkbox-indicator">✓</Menu.CheckboxItemIndicator>
          Status
        </Menu.CheckboxItem>
        <Menu.RadioGroup defaultValue="name">
          <Menu.RadioItem value="name">
            <Menu.RadioItemIndicator data-testid="radio-indicator">•</Menu.RadioItemIndicator>
            Name
          </Menu.RadioItem>
          <Menu.RadioItem value="date">
            <Menu.RadioItemIndicator>•</Menu.RadioItemIndicator>
            Date
          </Menu.RadioItem>
        </Menu.RadioGroup>
        <Menu.LinkItem href="#docs">
          <span aria-hidden="true">↗</span>
          Docs
        </Menu.LinkItem>
      </Menu.List>
    </>
  );
}

async function expectFilteringKeepsIndicators(user: { type: Function; clear: Function }) {
  const checkbox = screen.getByRole('menuitemcheckbox', { name: /Status/ });
  const radio = screen.getByRole('menuitemradio', { name: /Name/ });
  expect(checkbox).toHaveAttribute('aria-checked', 'true');
  expect(radio).toHaveAttribute('aria-checked', 'true');
  expect(screen.getByTestId('checkbox-indicator')).toHaveTextContent('✓');
  expect(screen.getByTestId('radio-indicator')).toHaveTextContent('•');

  const input = screen.getByRole('searchbox', { name: 'Filter' });
  await user.type(input, 'stat');
  await waitFor(() => {
    expect(screen.queryByRole('menuitemradio', { name: /Name/ })).toBe(null);
  });
  expect(screen.getByRole('menuitemcheckbox', { name: /Status/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(screen.getByTestId('checkbox-indicator')).toHaveTextContent('✓');
  expect(screen.queryByRole('menuitem', { name: /Docs/ })).toBe(null);

  await user.clear(input);
  await user.type(input, 'nothing matches');
  await waitFor(() => {
    expect(screen.getByText('No matches')).toBeVisible();
  });
  expect(screen.queryByRole('menuitemcheckbox')).toBe(null);

  await user.clear(input);
  await user.type(input, 'docs');
  await waitFor(() => {
    expect(screen.getByRole('menuitem', { name: /Docs/ })).not.toBe(null);
  });

  await user.clear(input);
  await waitFor(() => {
    expect(screen.getByRole('menuitemradio', { name: /Name/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });
  expect(screen.getByTestId('radio-indicator')).toHaveTextContent('•');
  expect(screen.getByRole('menuitemcheckbox', { name: /Status/ })).toHaveAttribute(
    'aria-checked',
    'true',
  );
}

describe('filterable item indicators', () => {
  const { render } = createRenderer();

  it('renders checkbox and radio item indicators in a filterable root menu and filters their items', async () => {
    const { user } = render(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Columns</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Items />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    await expectFilteringKeepsIndicators(user);
  });

  it('renders checkbox and radio item indicators in a filterable submenu and filters their items', async () => {
    const { user } = render(() => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>View</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot defaultOpen>
                  <Menu.SubmenuTrigger>
                    <span aria-hidden="true">▸</span>
                    Columns
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Items />
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));

    expect(screen.getByRole('menuitem', { name: /Columns/ })).toHaveTextContent('▸Columns');
    await expectFilteringKeepsIndicators(user);
  });
});
