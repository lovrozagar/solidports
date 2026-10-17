import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { expectNativePath } from '#test-utils';
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

describe('render forms after hydration (plan 3 leaf 5.1.2)', () => {
  // Each `render` value the port takes hydrates onto the server's elements: nothing is left
  // unclaimed, and the elements the server wrote are the ones the state updates reach.
  for (const name of [
    'renderTag',
    'renderConfig',
    'renderComponent',
    'renderComponentNoRef',
    'renderFunction',
  ] as const) {
    it(`claims the server elements of ${name} and updates them`, async () => {
      const { hydrate, unclaimedNodes } = renderServer(fixtures, name);
      const trigger = screen.getByTestId('trigger');
      const panel = screen.getByTestId('panel');
      hydrate();
      await new Promise<void>((done) => {
        queueMicrotask(done);
      });
      expect(unclaimedNodes()).toEqual([]);
      // The native path rendered both (a fallback would claim the same nodes on the slow path). Its
      // development mark is set through the ref, which a component that drops it never calls; the
      // cost tests pin that form's path.
      if (name !== 'renderComponentNoRef') {
        expectNativePath(trigger, panel);
      }
      fireEvent.click(trigger);
      flush();
      expect(screen.getByTestId('trigger')).toBe(trigger);
      expect(screen.getByTestId('panel')).toBe(panel);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-closed');
      fireEvent.click(trigger);
      flush();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(panel).toHaveAttribute('data-open');
    });
  }
});
