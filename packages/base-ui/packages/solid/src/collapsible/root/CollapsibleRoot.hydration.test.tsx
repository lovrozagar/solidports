/*
 * Parts mounted after a hydration (client navigation in a server-rendered app) render their
 * children: `provideContext` must resolve the provider's children after Solid's hydration runtime
 * is enabled, as before it.
 */
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import accordionFixtures from '../../accordion/root/AccordionRoot.ssr-fixtures';
import fixtures from './CollapsibleRoot.ssr-fixtures';

describe('<Collapsible.Root /> after hydration', () => {
  const { render } = createRenderer();

  it('renders its children when mounted after a server-rendered tree hydrated', async () => {
    const { hydrate } = renderServer(accordionFixtures, 'defaultOpen');
    hydrate();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Trigger 1' })).toHaveAttribute('aria-expanded');
    });

    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Client trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));

    expect(screen.getByRole('button', { name: 'Client trigger' })).toBeInTheDocument();
  });
});

describe('<Collapsible.Root /> hydration', () => {
  it('renders the client state when it changes while hydrating', async () => {
    const { hydrate } = renderServer(fixtures, 'openedDuringHydration');
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-closed');
    hydrate();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
    expect(root).toHaveAttribute('data-open');
    expect(root).not.toHaveAttribute('data-closed');
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-panel-open');
  });
});
