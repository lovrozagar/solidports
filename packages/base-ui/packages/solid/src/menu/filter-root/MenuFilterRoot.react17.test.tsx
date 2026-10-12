import { expect, describe, it } from 'vitest';
import { Menu } from '@solidports/base-ui/menu';
import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';

// Solid: ids always come from the Solid runtime, so there is no React 17 `useId` fallback to mock,
// and the test harness has no `renderToString`/`hydrate` renderer; these cases render on the client.
describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider> with the React 17 id fallback', () => {
  const { render } = createRenderer();

  it('omits partial ids during SSR and wires relationships after hydration', async () => {
    render(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    expect(document.querySelector('[id*="undefined"]')).toBe(null);

    const trigger = screen.getByRole('button', { name: 'Actions' });
    const popup = screen.getByRole('dialog');
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const list = screen.getByRole('menu');
    const item = screen.getByRole('menuitem', { name: 'Rename' });

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
    expect(input).toHaveAttribute('aria-controls', list.id);
    expect(item.id).toMatch(/^base-ui-/);
  });

  it('registers a submenu trigger after fallback ids resolve', async () => {
    const { user } = render(() => (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>More actions</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter more actions" />
                            <Menu.List>
                              <Menu.Item>Share</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown][ArrowRight]');

    const trigger = screen.getByRole('menuitem', { name: 'More actions' });
    const popup = await screen.findByRole('dialog', { name: 'More actions' });
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter more actions' })).toHaveFocus();
    });
    expect(trigger.id).toMatch(/^base-ui-/);
    expect(trigger).toHaveAttribute('aria-controls', popup.id);
  });
});
