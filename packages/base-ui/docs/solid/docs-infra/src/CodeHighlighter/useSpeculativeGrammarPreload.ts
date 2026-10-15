import { createEffect, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import { ensureGrammars } from '../pipeline/parseSource/grammarCache';

/**
 * On first render, start loading the grammar chunks a block is about to need for
 * client-side highlighting, so they are in flight before `useCode` mounts and
 * the parse runs. Mirrors {@link useSpeculativeCodePreload} /
 * {@link useSpeculativeUseCodePreload}: detection is cheap and synchronous
 * (`detectGrammarScopes` reads only metadata), the load runs in a mount effect
 * (so it never blocks first paint), and `ensureGrammars` dedupes with the
 * eventual consumer (`useGrammarsReady`) and is a no-op when warm.
 *
 * The signal is deliberately accurate so a block needs only its own languages: a
 * fully-precomputed read-only block (which renders its highlighted HAST and
 * never calls `parseSource`) sets `enabled = false` and loads no grammar at all,
 * and a `tsx`+`css` block loads only those two grammars instead of all ten.
 */
export function useSpeculativeGrammarPreload(
  _params: Accessor<{
    /** Grammar scopes the block needs (should be memoized by the caller). */
    scopes: string[];
    /** Whether the block will highlight client-side (or live-edit). */
    enabled: boolean;
  }>,
): void {
  const _params2 = createMemo(() => {
    const { scopes, enabled } = _params();
    return {
      scopes,
      enabled,
    };
  });
  createEffect(
    () => [_params2().enabled, _params2().scopes],
    () => {
      const _scopes = _params2().scopes;
      // Best-effort head start; swallow rejections (the consumer surfaces any real
      // load error, and `parseSource` degrades to plain text). No-op when warm.
      if (_params2().enabled && _scopes.length > 0) {
        ensureGrammars(_scopes).catch(() => {});
      }
    },
  );
}
