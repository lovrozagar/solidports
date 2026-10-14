import { expect, describe, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { renderServer } from '../../../test/ssrFixtures';
import ssrFixtures from './MenuFilterRoot.ssr-fixtures';

// Solid: ids always come from the Solid runtime, so there is no React 17 `useId` fallback to mock.
// The server render (`renderServer`, the `renderToString` counterpart) carries the runtime's ids,
// and hydration keeps them.
describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider> with the React 17 id fallback', () => {
  it('omits partial ids during SSR and wires relationships after hydration', async () => {
    const { hydrate } = renderServer(ssrFixtures, 'relationships');

    expect(document.querySelector('[id*="undefined"]')).toBe(null);

    hydrate();

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
    const { hydrate } = renderServer(ssrFixtures, 'submenu');

    const { user } = hydrate();
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
