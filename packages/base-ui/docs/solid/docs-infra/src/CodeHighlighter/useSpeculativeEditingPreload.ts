import { createEffect, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import { useCodeContext } from '../CodeProvider/CodeContext';
import { preloadCodeEmphasis } from '../pipeline/enhanceCodeEmphasis/enhanceCodeEmphasisLazy';
import { ensureGrammars } from '../pipeline/parseSource/grammarCache';
import { preloadCodeEditor } from '../useCode/codeEditorCache';

/**
 * Warms ALL the live-editing dependencies a block needs — the textarea editor,
 * per-language grammars, the emphasis
 * enhancer, and the off-main-thread worker — so they are in flight before the
 * user edits. Mirrors {@link useSpeculativeCodePreload}: detection is cheap and
 * synchronous, the work runs in a mount/activation effect (never blocking first
 * paint), and each fetch is deduped page-wide with the eventual consumer.
 *
 * Timing follows `editActivation`:
 * - `'eager'` (default): warms on mount once the block is `enabled` (editable).
 * - `'interaction'`: warms only once the block is `activated` — the editor
 *   fires `onActivate` on first engagement (hover / focus / click), and
 *   `CodeHighlighter` flips `activated`. This is the single moment that kicks off
 *   every editing dependency, rather than each loading on its own trigger.
 *
 * A read-only block sets `enabled = false` and warms nothing.
 */
export function useSpeculativeEditingPreload(
  _params: Accessor<{
    enabled: boolean;
    editActivation?: 'eager' | 'interaction';
    /** Whether an `'interaction'` block has engaged yet (ignored when `'eager'`). */
    activated?: boolean;
    /**
     * Grammar scopes the editable block uses, so its grammars (main thread) and the
     * worker can be warmed for live re-highlighting (should be memoized by the caller).
     */
    scopes?: string[];
  }>,
): void {
  const _params2 = createMemo(() => {
    const { enabled, editActivation, activated = false, scopes } = _params();
    return {
      enabled,
      editActivation,
      scopes,
      activated,
    };
  });
  const _useCodeContext = useCodeContext();
  const _useCodeContext2 = createMemo(() => {
    const { codeEditorLoader, ensureParseSourceWorker } = _useCodeContext();
    return {
      codeEditorLoader,
      ensureParseSourceWorker,
    };
  });
  // In `'interaction'` mode, wait for engagement; otherwise warm on mount.
  const shouldWarm = createMemo(
    () =>
      _params2().enabled &&
      ((_params2().editActivation ?? 'eager') !== 'interaction' || _params2().activated),
  );
  createEffect(
    () => [
      shouldWarm(),
      _useCodeContext2().codeEditorLoader,
      _useCodeContext2().ensureParseSourceWorker,
      _params2().scopes,
    ],
    () => {
      // Best-effort head start; swallow rejections (the real consumers surface any
      // load error). `?.()?.catch` no-ops cleanly when no provider supplies the
      // accessor.
      if (!shouldWarm()) {
        return;
      }
      preloadCodeEditor(_useCodeContext2().codeEditorLoader).catch(() => {});
      // Warm the emphasis enhancer too, so the first live-edit re-enhancement
      // (a synchronous render-path) runs without a flash under `CodeProviderLazy`.
      preloadCodeEmphasis().catch(() => {});
      const _scopes = _params2().scopes;
      if (_scopes && _scopes.length > 0) {
        // Main-thread grammars for the edited file...
        ensureGrammars(_scopes).catch(() => {});
        // ...and the (lazily-created) worker with the same grammars, so
        // off-main-thread highlighting is ready before the first keystroke. No-op
        // without a worker (no provider, SSR, or no `Worker`).
        void _useCodeContext2().ensureParseSourceWorker?.(_scopes);
      }
    },
  );
}
