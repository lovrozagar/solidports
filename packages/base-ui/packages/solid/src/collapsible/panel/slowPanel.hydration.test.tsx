/*
 * A slow-path panel (a `render` prop, or props made a proxy by a spread) hydrates to the attributes the same panel rendered on the
 * client has: the server renders the dimension variables at `auto`, and hydration must not drop
 * what the client keeps.
 */
import { flush } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { createRenderer, expectSlowPath } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './slowPanel.ssr-fixtures';

/** The panel's attributes: hydration keys and generated ids left out, style declarations sorted. */
function attributesOf(element: Element) {
  const attributes: Record<string, string> = {};
  for (const { name, value } of element.attributes) {
    if (name === '_hk' || name === 'id' || name === 'aria-labelledby') {
      continue;
    }
    attributes[name] =
      name === 'style'
        ? value
            .split(';')
            .map((declaration) => declaration.trim().replace(/\s*:\s*/, ':'))
            .filter(Boolean)
            .sort()
            .join(';')
        : value;
  }
  return attributes;
}

const settle = async () => {
  await new Promise<void>((done) => {
    requestAnimationFrame(() => setTimeout(done));
  });
  flush();
};

describe('a slow-path panel after hydration', () => {
  const { render } = createRenderer();

  it.each(Object.keys(fixtures.fixtures) as (keyof typeof fixtures.fixtures)[])(
    'has the attributes the client renders (%s)',
    async (name) => {
      const { hydrate } = renderServer(fixtures, name);
      const view = hydrate();
      await settle();
      expectSlowPath(screen.getByTestId('panel'));
      const hydrated = attributesOf(screen.getByTestId('panel'));
      view.dispose();

      render(fixtures.fixtures[name]);
      await settle();
      expect(hydrated).toEqual(attributesOf(screen.getByTestId('panel')));
    },
  );

  it.each(Object.keys(fixtures.fixtures) as (keyof typeof fixtures.fixtures)[])(
    'renders the client attributes on the server (%s)',
    async (name) => {
      renderServer(fixtures, name);
      const server = attributesOf(screen.getByTestId('panel'));
      document.body.innerHTML = '';

      render(fixtures.fixtures[name]);
      await settle();
      expect(server).toEqual(attributesOf(screen.getByTestId('panel')));
    },
  );
});
