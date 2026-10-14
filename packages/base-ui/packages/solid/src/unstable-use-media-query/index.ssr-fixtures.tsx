import { defineSsrFixtures } from '../../test/defineSsrFixtures';
import { useMediaQuery } from './index';

const QUERY = '(min-width: 600px)';

function Test(props: { options: useMediaQuery.Options }) {
  const matches = useMediaQuery(QUERY, props.options);
  return <span data-testid="result">{String(matches())}</span>;
}

// The server has no `window.matchMedia`; each fixture's media list only matches the tested query.
// Hydration subscribes to it, so it has the listener methods of a `MediaQueryList`.
const matchingMedia = ((query: string) => ({
  matches: query === QUERY,
  addEventListener() {},
  removeEventListener() {},
})) as unknown as typeof matchMedia;

export default defineSsrFixtures(import.meta.url, {
  ssrMatchMedia: () => (
    <Test options={{ ssrMatchMedia: (query) => ({ matches: query === QUERY }) }} />
  ),
  noSsr: () => <Test options={{ matchMedia: matchingMedia, defaultMatches: false, noSsr: true }} />,
  withoutNoSsr: () => <Test options={{ matchMedia: matchingMedia, defaultMatches: false }} />,
});
