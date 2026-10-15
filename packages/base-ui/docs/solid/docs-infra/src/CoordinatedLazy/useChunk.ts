import { createEffect, createMemo, createSignal, onSettled, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { ChunkComponentProps, StreamSource, CreateChunkConfig } from './types';
import { useChunkContext } from '../ChunkProvider/ChunkContext';
import { requestIdle } from '../useCoordinated/scheduleTasks';

/** Result of {@link useChunk}. */
export interface UseChunkResult<P> {
  /** The chunk's data: the loaded value, or the initial/preloaded value while loading. */
  data: P | undefined;
  /** `true` until the full data has loaded. */
  loading: boolean;
  /** `true` while a background refresh is in flight; the current `data` stays visible. */
  revalidating: boolean;
  /**
   * Re-run the `data`-mode loader and swap in fresh data, keeping the current
   * data visible meanwhile (stale-while-revalidate). Aborts any prior in-flight
   * refresh. A no-op for non-`data` sources or when no source resolves.
   */
  refresh: () => Promise<void>;
}

/**
 * Load a single chunk's data on the client (props-context-layering: when the
 * data already arrived via `preloaded`, no fetch happens). Handles the
 * `controlled`/`preloaded` short-circuit and a quick `initial` value shown while
 * the full `data`-mode `load` resolves.
 *
 * Returns a `refresh()` that re-runs the loader with stale-while-revalidate, and
 * (opt-in via `config.revalidateOnIdle`) schedules one such refresh on the first
 * idle period after the chunk has loaded.
 *
 * Used by the component {@link createCoordinatedLazy} produces; consumers can
 * also call it directly for a custom chunk renderer.
 */
export function useChunk<T extends {}, P, O>(
  config: Accessor<CreateChunkConfig<T, P, O>>,
  _props?: Accessor<ChunkComponentProps<T, P, O> | undefined>,
): Accessor<UseChunkResult<P>> {
  const props = createMemo(() => {
    const _props3 = _props?.();
    return _props3 === undefined ? {} : _props3;
  });
  const _props2 = createMemo(() => {
    const { preloaded, controlled } = props();
    return {
      preloaded,
      controlled,
    };
  });
  const options = createMemo(() => (props().loaderOptions ?? config().loaderOptions) as O);
  const chunkContext = useChunkContext();
  const isLoaded = createMemo(() => {
    const _config = config();
    const _preloaded = _props2().preloaded;
    return (
      Boolean(_props2().controlled) ||
      (_config.isLoaded ? _config.isLoaded(_preloaded) : _preloaded !== undefined)
    );
  });

  // The value shown while loading: the preloaded value if present, otherwise a
  // quick `initial` computed by a `data`-mode source.
  const initialData = createMemo<P | undefined>(() => {
    const _preloaded2 = _props2().preloaded;
    if (_preloaded2 !== undefined) {
      return _preloaded2;
    }
    const source = config().source;
    if (source && source.mode === 'data' && source.initial) {
      return source.initial(options());
    }
    return undefined;
  });
  const [data, setData] = createSignal<P | undefined>(() =>
    untrack(() => initialState(isLoaded() ? _props2().preloaded : initialData())),
  );
  // `true` once the async `data`-mode load has resolved. Derive `loading` during
  // render so that when `isLoaded` becomes true after mount (a `preloaded` value
  // or `controlled` flag arriving later via props) `loading` flips to false on
  // the next render without an extra effect pass.
  const [loaded, setLoaded] = createSignal<boolean>(false);
  const [revalidating, setRevalidating] = createSignal<boolean>(false);
  const loading = createMemo(() => !isLoaded() && !loaded());
  createEffect(
    () => [isLoaded(), config(), options(), chunkContext()],
    () => {
      if (isLoaded()) {
        return undefined;
      }
      const controller = new AbortController();
      const _config2 = config();
      const _chunkContext = chunkContext();
      const _options = options();
      (async () => {
        try {
          // Prefer the config source; otherwise fall back to a `ChunkProvider`'s
          // lazily-imported source (props-context-layering). The provider only
          // imports the loader module here - never when the chunk is preloaded.
          let source = _config2.source;
          if (!source && _chunkContext) {
            source = (await _chunkContext.resolveSource()) as StreamSource<P, O>;
          }
          // Only a `data`-mode source loads a single chunk on the client; `urls` /
          // `stream` sources are driven by `useStream` at the list level.
          if (!source || source.mode !== 'data') {
            return;
          }
          const result = await source.load(_options, controller.signal);
          if (!controller.signal.aborted) {
            setData(() => result);
            setLoaded(true);
          }
        } catch {
          // Aborted by a newer load, or the load failed - leave the loading
          // state in place for the consumer's fallback / a retry.
        }
      })();
      return () => controller.abort();
    },
  );
  // A `refresh()` re-runs the `data`-mode loader, keeping the current data
  // visible (stale-while-revalidate). Serialized via a ref so a newer refresh
  // aborts an older one and the latest result wins.
  const refreshControllerRef: {
    current: AbortController | null;
  } = {
    current: null,
  };
  const refresh = async () => {
    refreshControllerRef.current?.abort();
    const controller = new AbortController();
    refreshControllerRef.current = controller;
    let source = config().source;
    const _chunkContext2 = chunkContext();
    if (!source && _chunkContext2) {
      source = (await _chunkContext2.resolveSource()) as StreamSource<P, O>;
    }
    if (!source || source.mode !== 'data' || controller.signal.aborted) {
      return;
    }
    setRevalidating(true);
    try {
      const result = await source.load(options(), controller.signal);
      if (!controller.signal.aborted) {
        setData(() => result);
        setLoaded(true);
        setRevalidating(false);
      }
    } catch {
      // Aborted by a newer refresh, or the load failed - keep the current data.
      if (!controller.signal.aborted) {
        setRevalidating(false);
      }
    }
  };

  // Opt-in stale-while-revalidate: once the chunk has loaded, revalidate in the
  // background on the first idle period. Browser-only; cancelled on unmount.
  createEffect(
    () => [config().revalidateOnIdle, loading(), refresh],
    () => {
      if (!config().revalidateOnIdle || loading() || typeof window === 'undefined') {
        return undefined;
      }
      return requestIdle(() => {
        refresh().catch(() => {});
      });
    },
  );
  onSettled(() => () => {
    refreshControllerRef.current?.abort();
  });
  return createMemo(() => ({
    data: data(),
    loading: loading(),
    revalidating: revalidating(),
    refresh,
  }));
}
