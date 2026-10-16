import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures, { setShowMiddleItem } from './AccordionRoot.ssr-fixtures';

/** Each item's `data-index`, in DOM order. */
const indexes = () =>
  ['a', 'b', 'c']
    .map((name) => screen.queryByRole('button', { name })?.closest('h3')?.parentElement)
    .filter((item) => item != null)
    .map((item) => item.getAttribute('data-index'));

describe('<Accordion.Root /> hydration', () => {
  it('keeps the item indexes in DOM order when an item appears between hydrated ones', async () => {
    setShowMiddleItem(false);
    const { html, hydrate } = renderServer(fixtures, 'conditionalMiddleItem');
    // The server guesses from creation order.
    expect(html.match(/data-index="\d+"/g)).toEqual(
      expect.arrayContaining(['data-index="0"', 'data-index="1"']),
    );
    hydrate();
    await waitFor(() => {
      expect(indexes()).toEqual(['0', '1']);
    });
    setShowMiddleItem(true);
    flush();
    await waitFor(() => {
      expect(indexes()).toEqual(['0', '1', '2']);
    });
    setShowMiddleItem(false);
  });
});
