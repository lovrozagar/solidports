import { expect, describe, it } from 'vitest';
import { screen, waitFor } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../test/ssrFixtures';
import { useIsHydrating } from './useIsHydrating';
import fixtures from './useIsHydrating.ssr-fixtures';

describe('useIsHydrating', () => {
  const { render } = createRenderer();

  function TestComponent() {
    const isHydrating = useIsHydrating();

    return <span data-testid="value">{String(isHydrating())}</span>;
  }

  it('returns false for client-only mounts', async () => {
    await render(TestComponent);

    expect(screen.getByTestId('value')).toHaveTextContent('false');
  });

  it('returns true before hydration for server-rendered markup', async () => {
    renderServer(fixtures, 'value');

    expect(screen.getByTestId('value')).toHaveTextContent('true');
  });

  it('switches to false after hydration completes', async () => {
    const { hydrate } = renderServer(fixtures, 'value');

    expect(screen.getByTestId('value')).toHaveTextContent('true');

    hydrate();

    await waitFor(() => {
      expect(screen.getByTestId('value')).toHaveTextContent('false');
    });
  });
});
