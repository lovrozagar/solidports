/*
 * A hydrated native part writes its literal attributes (the consumer's and its own) once, outside
 * its attribute effect. Every later update must leave them: after hydration and two updates, each
 * part on the native server path has the attributes the same tree rendered on the client has.
 */
import { flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { createRenderer, expectNativePath } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './hydratedLiterals.ssr-fixtures';

type Name = keyof typeof fixtures.fixtures;

/** Each fixture's parts, and the two updates applied after hydration. */
const TREES: Record<Name, { parts: string[]; updates: [string, string] }> = {
  collapsibleOpen: {
    parts: ['collapsible-root', 'collapsible-trigger', 'collapsible-panel'],
    updates: ['collapsible-trigger', 'collapsible-trigger'],
  },
  collapsibleClosed: {
    parts: ['collapsible-root', 'collapsible-trigger', 'collapsible-panel'],
    updates: ['collapsible-trigger', 'collapsible-trigger'],
  },
  accordionOpen: {
    parts: [
      'accordion-root',
      'accordion-item',
      'accordion-header',
      'accordion-trigger',
      'accordion-panel',
    ],
    updates: ['accordion-trigger', 'accordion-trigger-two'],
  },
  accordionClosed: {
    parts: [
      'accordion-root',
      'accordion-item',
      'accordion-header',
      'accordion-trigger',
      'accordion-panel',
    ],
    updates: ['accordion-trigger', 'accordion-trigger-two'],
  },
};

/** The part's attributes: names sorted, generated ids and hydration keys left out of the values. */
function attributesOf(testId: string) {
  const element = screen.getByTestId(testId);
  return Object.fromEntries(
    [...element.attributes]
      .filter(({ name }) => name !== '_hk')
      .map(({ name, value }) => [
        name,
        name === 'style'
          ? value
              .split(';')
              .map((declaration) => declaration.replace(/\s*:\s*/, ':').trim())
              .filter(Boolean)
              .sort()
              .join(';')
          : value.replace(/base-ui-[\w-]+/g, '<generated>'),
      ])
      .sort(([a], [b]) => (a < b ? -1 : 1)),
  );
}

/** The part's attributes after the tree settles, then after each update. */
async function sequence(name: Name, part: string) {
  await Promise.resolve();
  flush();
  // Both renders must be the native path's: a spread, say, would move a part to the slow path.
  expectNativePath(screen.getByTestId(part));
  const states = [attributesOf(part)];
  for (const trigger of TREES[name].updates) {
    fireEvent.click(screen.getByTestId(trigger));
    flush();
    states.push(attributesOf(part));
  }
  return states;
}

describe('a hydrated native part', () => {
  const { render } = createRenderer();

  describe.each(Object.keys(TREES) as Name[])('%s', (name) => {
    it.each(TREES[name].parts)(
      'keeps its literal attributes through two updates (%s)',
      async (part) => {
        const { hydrate } = renderServer(fixtures, name);
        const view = hydrate();
        const hydrated = await sequence(name, part);
        view.dispose();

        render(fixtures.fixtures[name]);
        const onTheClient = await sequence(name, part);

        for (const state of hydrated) {
          expect(state).toMatchObject({
            'data-testid': part,
            'aria-label': `${part} label`,
            id: `${part}-id`,
          });
        }
        expect(hydrated).toEqual(onTheClient);
      },
    );
  });
});
