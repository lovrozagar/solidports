import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { ChunkContextValue } from './types';

/**
 * Supplies the lazily-resolved client `StreamSource` to descendant chunks.
 * `undefined` outside a `ChunkProvider` - a chunk then relies on its own config
 * source (or stays in its loading/preloaded state).
 */
export const ChunkContext = createContext<Accessor<ChunkContextValue | undefined>>(() => undefined);

/** Read the surrounding `ChunkProvider`, or `undefined` when there is none. */
export function useChunkContext(): Accessor<ChunkContextValue | undefined> {
  return useContext(ChunkContext);
}
