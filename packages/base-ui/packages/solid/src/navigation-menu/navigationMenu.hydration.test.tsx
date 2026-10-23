/*
 * A hydrated NavigationMenu's native Item, Icon and Link claim the server's elements on the native
 * path and follow their inputs afterwards exactly as the same tree rendered on the client does:
 * after hydration and two updates, each part has the client render's attributes.
 */
import { flush } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { createRenderer, expectNativePath } from '#test-utils';
import { renderServer } from '../../test/ssrFixtures';
import fixtures, { setActive } from './navigationMenu.ssr-fixtures';

const PARTS = ['item-a', 'icon-a', 'link-reactive', 'link-literal', 'item-b', 'link-plain'];
const UPDATES = [() => setActive(true), () => setActive(false)];

/** The part's attributes and text: names sorted, hydration keys left out. */
function partOf(testId: string) {
  const element = screen.getByTestId(testId);
  return {
    attributes: Object.fromEntries(
      [...element.attributes]
        .filter(({ name }) => name !== '_hk')
        .map(({ name, value }) => [name, value])
        .sort(([a], [b]) => (a < b ? -1 : 1)),
    ),
    text: element.textContent,
  };
}

/** Every part after the tree settles, then after each update. */
async function sequence() {
  await Promise.resolve();
  flush();
  for (const part of PARTS) {
    // A spread, say, would move a part to the slow path.
    expectNativePath(screen.getByTestId(part));
  }
  const states = [PARTS.map(partOf)];
  for (const update of UPDATES) {
    update();
    flush();
    states.push(PARTS.map(partOf));
  }
  return states;
}

describe('a hydrated native NavigationMenu item, icon and link', () => {
  const { render } = createRenderer();

  it('follow their inputs as the client render does', async () => {
    setActive(false);
    flush();
    const { hydrate } = renderServer(fixtures, 'menu');
    const view = hydrate();
    const hydrated = await sequence();
    view.dispose();

    setActive(false);
    flush();
    render(fixtures.fixtures.menu);
    const onTheClient = await sequence();

    expect(hydrated).toEqual(onTheClient);
    // The updates changed something: the comparison is not over three identical states.
    expect(new Set(hydrated.map((state) => JSON.stringify(state))).size).toBeGreaterThan(1);
  });
});
