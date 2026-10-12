import { createEffect, createSignal, isHydrating, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';
import { access, type MaybeAccessor } from '../solid-helpers';
import { addEventListener } from '../utils/addEventListener';

export function useMediaQuery(
  query: MaybeAccessor<string>,
  options: useMediaQuery.Options,
): Accessor<boolean> {
  // Wait for jsdom to support the match media feature.
  // All the browsers Base UI support have this built-in.
  // This defensive check is here for simplicity.
  // Most of the time, the match media logic isn't central to people's tests.
  const supportMatchMedia = () =>
    typeof window !== 'undefined' && typeof window.matchMedia !== 'undefined';

  const safeQuery = () => access(query).replace(/^@media( ?)/m, '');
  const defaultMatches = () => access(options.defaultMatches) ?? false;
  const matchMedia = () =>
    options.matchMedia === undefined
      ? supportMatchMedia()
        ? window.matchMedia
        : null
      : options.matchMedia;

  // `useSyncExternalStore`'s server snapshot: what the server renders and hydration starts from.
  const getServerSnapshot = () => {
    const matchMediaValue = matchMedia();
    if (access(options.noSsr) && matchMediaValue) {
      return matchMediaValue(safeQuery()).matches;
    }
    if (options.ssrMatchMedia != null) {
      return options.ssrMatchMedia(safeQuery()).matches;
    }
    return defaultMatches();
  };

  if (isServer) {
    // The server value is constant, so it is returned directly rather than written into state
    // (a server render writes no state).
    const matches = getServerSnapshot();
    return () => matches;
  }

  const getSnapshot = () => {
    const matchMediaValue = matchMedia();
    return matchMediaValue === null ? defaultMatches() : matchMediaValue(safeQuery()).matches;
  };

  // A client render reads the media query at once; hydration starts from the server snapshot.
  const [match, setMatch] = createSignal(untrack(isHydrating() ? getServerSnapshot : getSnapshot));

  createEffect(
    () => ({ matchMediaValue: matchMedia(), query: safeQuery(), fallback: defaultMatches() }),
    (current) => {
      const matchMediaValue = current.matchMediaValue;
      if (matchMediaValue === null) {
        setMatch(current.fallback);
        return undefined;
      }

      // Called unbound, as `window.matchMedia` would be: a method call would pass the deps object
      // as the receiver, which the browser rejects.
      const mediaQueryList = matchMediaValue(current.query);
      const notify = () => setMatch(mediaQueryList.matches);
      notify();
      return addEventListener(mediaQueryList, 'change', notify);
    },
  );

  return match;
}

export interface UseMediaQueryOptions {
  /**
   * As `window.matchMedia()` is unavailable on the server,
   * it returns a default matches during the first mount.
   * @default false
   */
  defaultMatches?: MaybeAccessor<boolean | undefined>;
  /**
   * You can provide your own implementation of matchMedia.
   * This can be used for handling an iframe content window.
   */
  matchMedia?: typeof window.matchMedia | undefined;
  /**
   * To perform the server-side hydration, the hook needs to render twice.
   * A first time with `defaultMatches`, the value of the server, and a second time with the resolved value.
   * This double pass rendering cycle comes with a drawback: it's slower.
   * You can set this option to `true` if you use the returned value **only** client-side.
   * @default false
   */
  noSsr?: MaybeAccessor<boolean | undefined>;
  /**
   * You can provide your own implementation of `matchMedia`, it's used when rendering server-side.
   */
  ssrMatchMedia?: ((query: string) => { matches: boolean }) | undefined;
}

export interface UseMediaQueryState {}

export namespace useMediaQuery {
  export type State = UseMediaQueryState;
  export type Options = UseMediaQueryOptions;
}
