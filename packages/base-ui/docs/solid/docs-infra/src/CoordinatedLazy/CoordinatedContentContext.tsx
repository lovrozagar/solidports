import { createContext, createMemo, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { CoordinatedContentContextValue } from './types';

/**
 * Carries the data the fallback hoisted down into the full content. A
 * `CoordinatedLazy` provides it around `content` after the swap; content reads
 * it via {@link useCoordinatedContent}.
 */
export const CoordinatedContentContext = createContext<Accessor<CoordinatedContentContextValue>>(
  () => ({
    hoisted: {},
  }),
);

/**
 * Read the data the fallback hoisted, from inside the full content. Lets the
 * content use what the fallback fetched (e.g. a decompression dictionary)
 * without the consumer threading it through props. Returns an empty map when
 * rendered outside a `CoordinatedLazy`.
 */
export function useCoordinatedContent(): Accessor<Record<string, unknown>> {
  const _useContext = useContext(CoordinatedContentContext);
  return createMemo(() => _useContext().hoisted);
}
