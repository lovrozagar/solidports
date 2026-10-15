import { createEffect, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useCodeContext } from '../CodeProvider/CodeContext';

/**
 * On first render, kick off the heavy loaders a code block is about to need, so
 * the work is already in flight before the content mounts and awaits it. The
 * detection is cheap and synchronous (props + manifest); the loaders are called
 * in a mount effect, so this never blocks first paint.
 *
 * Calling an accessor is instant under an eager `CodeProvider` and starts a
 * deduped fetch under `CodeProviderLazy` (the same promise the eventual consumer
 * resolves), so this is purely a head start - no extra work and no duplicate
 * fetch. The signals are deliberately accurate (a fully-precomputed block sets
 * neither) so a code-free or precomputed page never prefetches a chunk it won't
 * use.
 */
export function useSpeculativeCodePreload(
  _params: Accessor<{
    /**
     * The block will fetch code (no complete precomputed/controlled code). Also
     * covers the multi-variant case where switching will load a not-yet-present
     * variant - so a fully-precomputed multi-variant block correctly sets `false`.
     */
    needsData: boolean;
    /** Transforms will be computed client-side (manifest declares them, not yet highlighted). */
    hasTransforms: boolean;
  }>,
): void {
  const _params2 = createMemo(() => {
    const { needsData, hasTransforms } = _params();
    return {
      needsData,
      hasTransforms,
    };
  });
  const _useCodeContext = useCodeContext();
  const _useCodeContext2 = createMemo(() => {
    const { loadCodeFallbackLoader, loadIsomorphicCodeVariantLoader, computeHastDeltasLoader } =
      _useCodeContext();
    return {
      loadCodeFallbackLoader,
      loadIsomorphicCodeVariantLoader,
      computeHastDeltasLoader,
    };
  });
  createEffect(
    () => [
      _params2().needsData,
      _params2().hasTransforms,
      _useCodeContext2().loadCodeFallbackLoader,
      _useCodeContext2().loadIsomorphicCodeVariantLoader,
      _useCodeContext2().computeHastDeltasLoader,
    ],
    () => {
      // Best-effort head start; swallow rejections (the real consumer surfaces any
      // load error). `?.()?.catch` no-ops cleanly when no provider supplies the
      // accessor.
      if (_params2().needsData) {
        _useCodeContext2()
          .loadCodeFallbackLoader?.()
          ?.catch(() => {});
        _useCodeContext2()
          .loadIsomorphicCodeVariantLoader?.()
          ?.catch(() => {});
      }
      if (_params2().hasTransforms) {
        _useCodeContext2()
          .computeHastDeltasLoader?.()
          ?.catch(() => {});
      }
    },
  );
}
