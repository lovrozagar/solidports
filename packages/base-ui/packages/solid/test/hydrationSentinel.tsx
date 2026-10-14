import { createComponent, createSignal, Errored, Loading } from 'solid-js';
import type { JSX } from '@solidjs/web';

// No `vitest` import: the global setup server-renders this module through Vite's SSR loader.

export const HYDRATION_SENTINEL = 'data-hydration-sentinel';

const [sentinelValue, setSentinelValue] = createSignal(0);

/** Changes the value every sentinel renders; a claimed sentinel updates its attribute. */
export function advanceHydrationSentinel() {
  setSentinelValue((value) => value + 1);
}

/** The value a sentinel renders, as the server rendered it (the server never advances it). */
export function currentHydrationSentinel() {
  return sentinelValue();
}

/**
 * Renders a fixture followed by a sentinel: a plain element with a hydration key and a reactive
 * attribute. A fixture that creates a computation the server did not (or in another order) shifts
 * the hydration keys of everything rendered after it, so the sentinel is not claimed: the
 * server's element stays in the document, inert, and its attribute never moves.
 */
export function WithHydrationSentinel(props: { fixture: () => JSX.Element }) {
  return (
    <>
      {createComponent(props.fixture, {})}
      <span data-testid="hydration-sentinel" data-hydration-sentinel={sentinelValue()} />
    </>
  );
}

/**
 * `WithHydrationSentinel` inside an error and a loading boundary, as a routed page renders its
 * content: the boundaries' content hydrates in computations of its own.
 */
export function WithHydrationSentinelInBoundaries(props: { fixture: () => JSX.Element }) {
  return (
    <Errored fallback="Error">
      <Loading fallback="Loading">
        <WithHydrationSentinel fixture={props.fixture} />
      </Loading>
    </Errored>
  );
}

/** The server renders of each fixture, by key suffix. */
export const SERVER_RENDERS = {
  string: '',
  stream: '#stream',
  streamBoundaries: '#stream-boundaries',
} as const;

export type ServerRender = keyof typeof SERVER_RENDERS;
