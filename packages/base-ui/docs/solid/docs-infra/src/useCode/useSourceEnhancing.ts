import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { Root as HastRoot } from 'hast';
import { decodeHastSource } from '../pipeline/loadIsomorphicCodeVariant/decodeHastSource';
import type { SourceEnhancers, SourceComments, VariantSource } from '../CodeHighlighter/types';
import type { FallbackNode } from '../CodeHighlighter/fallbackFormat';
import {
  recordEnhancerApplied,
  shouldSkipEnhancer,
} from '../pipeline/loadIsomorphicCodeVariant/runSourceEnhancers';

// Safety-net deadline (ms) for the async enhancer pass. A client-side enhancer that
// REJECTS or HANGS would otherwise leave `asyncWork` non-null forever — keeping
// `isEnhancing` true and locking the consumer (`<Pre>` via `useFileNavigation`) at its
// un-enhanced 'base' phase until a full page reload. On failure/timeout we settle to the
// already sync-enhanced result so the phase advances.
const ENHANCER_TIMEOUT_MS = 10_000;

/**
 * Resolves a `VariantSource` to a HAST root that is safe to mutate.
 *
 * Uses the shared `decodeHastSource` cache to amortize decompression and
 * `JSON.parse` across other consumers (`Pre`, `useFileNavigation`,
 * `sourceLineCounts`), then `structuredClone`s the result because the
 * enhancer pipeline mutates `root.data` via `recordEnhancerApplied`.
 * Returns `null` for string or unrecognized sources.
 *
 * The variant `fallback` is forwarded to `decodeHastSource` so the compressed
 * payload is decompressed with the matching DEFLATE dictionary and each frame's
 * `data.fallback` is restored — enhancers then keep that per-frame fallback in
 * sync as they mutate the tree.
 */
function resolveHastRoot(
  source: VariantSource | undefined,
  fallback?: FallbackNode[],
): HastRoot | null {
  if (!source || typeof source === 'string') {
    return null;
  }
  const cached = decodeHastSource(source, fallback);
  return cached ? (structuredClone(cached) as HastRoot) : null;
}

/**
 * Applies enhancers sequentially to a HAST root, starting from a given index.
 * Each enhancer receives the output of the previous enhancer in the chain.
 * Enhancers with a stable `enhancerName` are skipped if already recorded on
 * the HAST root, and recorded after they run.
 */
async function applyEnhancersFrom(
  source: HastRoot,
  comments: SourceComments | undefined,
  fileName: string,
  enhancers: SourceEnhancers,
  startIndex: number,
): Promise<HastRoot> {
  let current = source;
  for (let i = startIndex; i < enhancers.length; i += 1) {
    const enhancer = enhancers[i];
    if (shouldSkipEnhancer(current, enhancer)) {
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    current = await enhancer(current, comments, fileName);
    recordEnhancerApplied(current, enhancer);
  }
  return current;
}
interface SyncEnhanceResult {
  /** The result after applying all sync enhancers (and resolving any leading async ones) */
  syncResult: HastRoot;
  /** Index of the first enhancer that returned a Promise, or enhancers.length if all were sync */
  asyncStartIndex: number;
  /** The promise returned by the first async enhancer, if any */
  firstAsyncPromise: Promise<HastRoot> | null;
}

/**
 * Runs enhancers in order until one returns a Promise.
 * Returns the sync-enhanced result up to that point, plus the pending promise
 * and its index so the caller can continue from there without re-running sync work.
 *
 * Enhancers with a stable `enhancerName` are skipped if already recorded on
 * the HAST root, and recorded after they run.
 */
function applyEnhancersUntilAsync(
  source: HastRoot,
  comments: SourceComments | undefined,
  fileName: string,
  enhancers: SourceEnhancers,
): SyncEnhanceResult {
  let current: HastRoot = source;
  for (let i = 0; i < enhancers.length; i += 1) {
    const enhancer = enhancers[i];
    if (shouldSkipEnhancer(current, enhancer)) {
      continue;
    }
    const result = enhancer(current, comments, fileName);
    if (result instanceof Promise) {
      return {
        syncResult: current,
        asyncStartIndex: i,
        firstAsyncPromise: result.then((resolved) => {
          recordEnhancerApplied(resolved, enhancer);
          return resolved;
        }),
      };
    }
    current = result;
    recordEnhancerApplied(current, enhancer);
  }
  return {
    syncResult: current,
    asyncStartIndex: enhancers.length,
    firstAsyncPromise: null,
  };
}
export interface UseSourceEnhancingProps {
  /** The source to enhance (from transformed files or variant) */
  source: VariantSource | null | undefined;
  /** The filename for this source */
  fileName: string | undefined;
  /** Comments extracted from the source (typically from the original variant) */
  comments: SourceComments | undefined;
  /** Array of enhancer functions to apply */
  sourceEnhancers?: SourceEnhancers;
  /** Fallback data for deriving the DEFLATE decompression dictionary */
  fallback?: FallbackNode[];
}
export interface UseSourceEnhancingResult {
  /** The enhanced source */
  enhancedSource: VariantSource | null;
  /** Whether enhancement is currently in progress */
  isEnhancing: boolean;
}

/**
 * Hook that applies source enhancers to a single source file.
 *
 * Enhancers are functions that modify the HAST (Hypertext Abstract Syntax Tree)
 * representation of code. They receive the parsed HAST root, any comments extracted
 * from the source code, and the filename for context.
 *
 * Enhancement runs asynchronously when the source or enhancers change.
 * The original source is returned immediately while enhancement runs in the background,
 * preventing layout shift since enhanced code should be visually similar.
 *
 * @example
 * ```tsx
 * // Enhancer that adds line highlighting based on comments
 * const highlightEnhancer: SourceEnhancer = (root, comments, fileName) => {
 *   // Use comments like { 5: ['@highlight'] } to add highlighting
 *   return addHighlightToLines(root, comments);
 * };
 *
 * function MyCodeDisplay({ source, fileName }) {
 *   const enhancers = React.useMemo(() => [highlightEnhancer], []);
 *   const { enhancedSource, isEnhancing } = useSourceEnhancing({
 *     source,
 *     fileName,
 *     comments: undefined,
 *     sourceEnhancers: enhancers,
 *   });
 *   return <Pre>{enhancedSource}</Pre>;
 * }
 * ```
 *
 * @remarks
 * - Only HAST sources can be enhanced. String sources are returned unchanged.
 * - Enhancers must return stable references to avoid infinite re-renders.
 * - Use `React.useMemo` for the enhancers array to prevent unnecessary re-runs.
 */
interface AsyncWork {
  firstAsyncPromise: Promise<HastRoot>;
  asyncStartIndex: number;
}
interface EnhanceState {
  enhancedSource: VariantSource | null;
  asyncWork: AsyncWork | null;
}

/**
 * Computes the synchronous enhancement result and any pending async work.
 * Enhancers are run in order; sync ones apply immediately, and the first
 * async enhancer's promise is captured so it can be continued in an effect.
 */
function computeEnhanceState(
  source: VariantSource | null | undefined,
  comments: SourceComments | undefined,
  fileName: string | undefined,
  sourceEnhancers: SourceEnhancers | undefined,
  fallback: FallbackNode[] | undefined,
): EnhanceState {
  if (!source || !sourceEnhancers || sourceEnhancers.length === 0) {
    return {
      enhancedSource: source ?? null,
      asyncWork: null,
    };
  }
  const resolved = resolveHastRoot(source, fallback);
  if (!resolved) {
    return {
      enhancedSource: source ?? null,
      asyncWork: null,
    };
  }
  const { syncResult, firstAsyncPromise, asyncStartIndex } = applyEnhancersUntilAsync(
    resolved,
    comments,
    fileName || 'unknown',
    sourceEnhancers,
  );
  return {
    enhancedSource: syncResult,
    asyncWork: firstAsyncPromise
      ? {
          firstAsyncPromise,
          asyncStartIndex,
        }
      : null,
  };
}
export function useSourceEnhancing(
  _params: Accessor<UseSourceEnhancingProps>,
): Accessor<UseSourceEnhancingResult> {
  const _params2 = createMemo(() => {
    const { source, fileName, comments, sourceEnhancers, fallback } = _params();
    return {
      source,
      fileName,
      comments,
      sourceEnhancers,
      fallback,
    };
  });
  // Track previous values to detect changes
  const [prevSource, setPrevSource] = createSignal(() =>
    untrack(() => initialState(_params2().source)),
  );
  const [prevEnhancers, setPrevEnhancers] = createSignal(() =>
    untrack(() => initialState(_params2().sourceEnhancers)),
  );
  const [prevComments, setPrevComments] = createSignal(() =>
    untrack(() => initialState(_params2().comments)),
  );
  const [prevFileName, setPrevFileName] = createSignal(() =>
    untrack(() => initialState(_params2().fileName)),
  );
  const [state, setState] = createSignal<EnhanceState>(() =>
    untrack(() =>
      computeEnhanceState(
        _params2().source,
        _params2().comments,
        _params2().fileName,
        _params2().sourceEnhancers,
        _params2().fallback,
      ),
    ),
  );
  const hasChanged = createMemo(
    () =>
      _params2().source !== prevSource() ||
      _params2().sourceEnhancers !== prevEnhancers() ||
      _params2().comments !== prevComments() ||
      _params2().fileName !== prevFileName(),
  );

  // When inputs change, apply sync enhancers immediately during render
  const _source = untrack(_params2).source;
  const _sourceEnhancers = untrack(_params2).sourceEnhancers;
  const _comments = untrack(_params2).comments;
  const _fileName = untrack(_params2).fileName;
  if (untrack(hasChanged)) {
    if (_source !== untrack(prevSource)) {
      setPrevSource(_source);
    }
    if (_sourceEnhancers !== untrack(prevEnhancers)) {
      setPrevEnhancers(_sourceEnhancers);
    }
    if (_comments !== untrack(prevComments)) {
      setPrevComments(_comments);
    }
    if (_fileName !== untrack(prevFileName)) {
      setPrevFileName(_fileName);
    }
    setState(
      computeEnhanceState(
        _source,
        _comments,
        _fileName,
        _sourceEnhancers,
        untrack(_params2).fallback,
      ),
    );
  }

  // Continue from the first async enhancer without re-running sync ones
  createEffect(
    () => [state().asyncWork, _params2().sourceEnhancers, _params2().fileName, _params2().comments],
    () => {
      const _state = state();
      const _sourceEnhancers2 = _params2().sourceEnhancers;
      if (!_state.asyncWork || !_sourceEnhancers2) {
        return undefined;
      }
      const { firstAsyncPromise, asyncStartIndex } = _state.asyncWork;
      const enhancers = _sourceEnhancers2;
      const name = _params2().fileName || 'unknown';
      let cancelled = false;

      // Clear `asyncWork` (keeping whatever enhanced source we already have) so
      // `isEnhancing` drops and the consumer's phase advances. Used by the failure and
      // timeout paths below — without it a rejected/hung enhancer wedges 'base' forever.
      const settleWithCurrent = () => {
        if (!cancelled) {
          setState((previous) => ({
            enhancedSource: previous.enhancedSource,
            asyncWork: null,
          }));
        }
      };

      // Safety net for a hung enhancer (a promise that never settles): force-settle after
      // the deadline so the un-enhanced phase isn't locked until a reload.
      const timer = setTimeout(settleWithCurrent, ENHANCER_TIMEOUT_MS);
      async function continueEnhancing() {
        try {
          const asyncResult = await firstAsyncPromise;
          if (cancelled) {
            return;
          }
          const final = await applyEnhancersFrom(
            asyncResult,
            _params2().comments,
            name,
            enhancers,
            asyncStartIndex + 1,
          );
          if (!cancelled) {
            setState({
              enhancedSource: final,
              asyncWork: null,
            });
          }
        } catch (error) {
          // A rejected async enhancer must not strand `asyncWork` non-null forever.
          console.error('Async source enhancer failed; settling with the current result.', error);
          settleWithCurrent();
        } finally {
          clearTimeout(timer);
        }
      }
      continueEnhancing();
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    },
  );
  return createMemo(() => ({
    enhancedSource: state().enhancedSource,
    isEnhancing: state().asyncWork !== null,
  }));
}
