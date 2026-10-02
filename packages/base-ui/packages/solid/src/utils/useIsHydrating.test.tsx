import { expect, describe, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { useIsHydrating } from './useIsHydrating';

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

  // Solid: jsdom resolves the client build of `@solidjs/web`, which has no `renderToString`.
  it.skip('returns true before hydration for server-rendered markup', () => {});

  // Solid: jsdom resolves the client build of `@solidjs/web`, which has no `renderToString`.
  it.skip('switches to false after hydration completes', () => {});
});
