import { expect, describe, it, vi } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { act, createRenderer, isJSDOM } from '#test-utils';
import { useMediaQuery } from '@solidports/base-ui/unstable-use-media-query';
import { renderServer } from '../../test/ssrFixtures';
import ssrFixtures from './index.ssr-fixtures';

function createMatchMedia(initialMatches: boolean) {
  const listeners = new Set<() => void>();
  const mediaQueryList = {
    matches: initialMatches,
    addEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: () => void) => {
      listeners.delete(listener);
    }),
  };
  const matchMedia = vi.fn(() => mediaQueryList) as unknown as typeof window.matchMedia;

  return {
    matchMedia,
    listeners,
    setMatches(matches: boolean) {
      mediaQueryList.matches = matches;
      listeners.forEach((listener) => listener());
    },
  };
}

describe('useMediaQuery', () => {
  const { render } = createRenderer();

  function Test(props: { query: string; options: useMediaQuery.Options }) {
    const matches = useMediaQuery(() => props.query, props.options);
    return <span data-testid="result">{String(matches())}</span>;
  }

  it('returns defaultMatches when matchMedia is unavailable', async () => {
    await render(() => <Test query="(min-width: 600px)" options={{ matchMedia: null! }} />);

    expect(screen.getByTestId('result')).toHaveTextContent('false');

    await render(() => (
      <Test query="(min-width: 600px)" options={{ matchMedia: null!, defaultMatches: true }} />
    ));

    expect(screen.getAllByTestId('result')[1]).toHaveTextContent('true');
  });

  it('subscribes to the provided matchMedia and updates on change', async () => {
    const media = createMatchMedia(false);

    const { unmount } = await render(() => (
      <Test query="@media (min-width: 600px)" options={{ matchMedia: media.matchMedia }} />
    ));

    expect(media.matchMedia).toHaveBeenCalledWith('(min-width: 600px)');
    expect(screen.getByTestId('result')).toHaveTextContent('false');

    await act(async () => {
      media.setMatches(true);
    });

    expect(screen.getByTestId('result')).toHaveTextContent('true');

    unmount();

    expect(media.listeners.size).toBe(0);
  });

  // Solid: the default `window.matchMedia` is called unbound, as the browser requires.
  it.skipIf(isJSDOM)('reads the window media query by default', async () => {
    await render(() => <Test query="(min-width: 1px)" options={{}} />);

    expect(screen.getByTestId('result')).toHaveTextContent('true');
  });

  // Solid: server output comes from `index.ssr-fixtures.tsx`, rendered by the server build. A
  // fixture's `ssrMatchMedia` only matches the tested query, so `true` shows it was called with it.
  it('uses ssrMatchMedia for the server snapshot', () => {
    const { container } = renderServer(ssrFixtures, 'ssrMatchMedia');

    expect(container.firstElementChild).toHaveTextContent('true');
  });

  it('uses the client matchMedia result as the server snapshot when noSsr is set', () => {
    const { container: withNoSsr } = renderServer(ssrFixtures, 'noSsr');

    expect(withNoSsr.firstElementChild).toHaveTextContent('true');

    const { container: withoutNoSsr } = renderServer(ssrFixtures, 'withoutNoSsr');

    expect(withoutNoSsr.firstElementChild).toHaveTextContent('false');
  });
});
