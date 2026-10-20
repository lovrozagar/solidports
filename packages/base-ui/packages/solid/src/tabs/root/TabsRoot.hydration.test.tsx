/*
 * Tabs hydrated from the server's markup: the selected value, the highlighted index and the panel
 * ids are read through per-key selectors (`createIdSelector`, `createKeyedValues`), which the
 * server never builds and the client builds lazily, in a scope that takes none of the parts'
 * hydration ids. The server's every node is claimed, and a switch after hydration moves the
 * selection, the roving tab stop and `aria-controls` to the new tab only.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './TabsRoot.ssr-fixtures';

const afterHydration = () =>
  new Promise<void>((done) => {
    queueMicrotask(done);
  });

describe('<Tabs.Root /> hydration', () => {
  it('claims every server node and switches tabs after hydrating', async () => {
    const { hydrate, unclaimedNodes } = renderServer(fixtures, 'switch');
    const [a, b, c] = screen.getAllByRole('tab');
    expect(a).toHaveAttribute('aria-selected', 'true');
    hydrate();
    await afterHydration();
    expect(unclaimedNodes()).toEqual([]);
    expect(screen.getAllByRole('tab')).toEqual([a, b, c]);
    const panelA = screen.getByRole('tabpanel');
    expect(a).toHaveAttribute('aria-controls', panelA.id);

    fireEvent.click(c);
    flush();
    expect(a).toHaveAttribute('aria-selected', 'false');
    expect(b).toHaveAttribute('aria-selected', 'false');
    expect(c).toHaveAttribute('aria-selected', 'true');
    expect(c).toHaveAttribute('tabindex', '0');
    expect(a).toHaveAttribute('tabindex', '-1');
    const panel = screen.getByRole('tabpanel');
    expect(panel).toHaveTextContent('Panel C');
    expect(c).toHaveAttribute('aria-controls', panel.id);
    expect(a).not.toHaveAttribute('aria-controls');
  });
});
