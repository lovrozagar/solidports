import { expect, describe, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../test/ssrFixtures';
import { useIsHydrated, useIsHydrating } from './hydration';
import fixtures, { createProbe } from './hydration.ssr-fixtures';

// Solid: `renderToString` counterpart. `renderServer` puts a fixture's server-rendered HTML in the
// document, and `hydrate()` takes it over on the client.
describe('hydration', () => {
  const { render } = createRenderer();

  describe('useIsHydrated', () => {
    const Probe = createProbe(useIsHydrated, 'hydrated');

    it('reports hydrated once mounted on the client', async () => {
      await render(() => <Probe />);

      expect(screen.getByTestId('hydrated')).toHaveTextContent('yes');
    });

    it('does not report hydrated while rendering on the server', () => {
      renderServer(fixtures, 'hydrated');

      expect(screen.getByTestId('hydrated')).toHaveTextContent('no');
    });
  });

  describe('useIsHydrating', () => {
    const Probe = createProbe(useIsHydrating, 'hydrating');

    it('does not report hydrating for a client-only mount', async () => {
      await render(() => <Probe />);

      expect(screen.getByTestId('hydrating')).toHaveTextContent('no');
    });

    it('reports hydrating while rendering on the server', () => {
      renderServer(fixtures, 'hydrating');

      expect(screen.getByTestId('hydrating')).toHaveTextContent('yes');
    });
  });

  // Solid: one hydration path. React 17's fallback settles the hooks after the client mount; here
  // the same transitions run when the client hydrates the server markup.
  describe('React 17 paths', () => {
    it('never reports hydrated on the server', () => {
      renderServer(fixtures, 'hydrated');

      expect(screen.getByTestId('hydrated')).toHaveTextContent('no');
    });

    it('reports hydrated once mounted on the client', async () => {
      const { hydrate } = renderServer(fixtures, 'hydrated');

      hydrate();

      await waitFor(() => {
        expect(screen.getByTestId('hydrated')).toHaveTextContent('yes');
      });
    });

    it('reports hydrating while rendering on the server', () => {
      renderServer(fixtures, 'hydrating');

      expect(screen.getByTestId('hydrating')).toHaveTextContent('yes');
    });

    it('stops reporting hydrating once mounted on the client', async () => {
      const { hydrate } = renderServer(fixtures, 'hydrating');

      hydrate();

      await waitFor(() => {
        expect(screen.getByTestId('hydrating')).toHaveTextContent('no');
      });
    });
  });
});
