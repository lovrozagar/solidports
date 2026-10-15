import { element } from 'docs/src/adapters/react';
import { createMemo } from 'solid-js';
import { Dynamic } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import type {
  ChunkComponentProps,
  ChunkContentProps,
  ChunkLoadingProps,
  ClientChunkConfig,
} from './types';
import { useChunk } from './useChunk';
import { CoordinatedLazy } from './CoordinatedLazy';

function RenderNull(): null {
  return null;
}

/** Props for {@link CoordinatedLazyClient}. */
export interface CoordinatedLazyClientProps<T extends {}, P, O> {
  /**
   * The chunk config with the server-only loader functions
   * (`source`/`Loader`/`InitialLoader`) already stripped, so no function is ever
   * serialized into this Client Component. Client loading comes from a
   * {@link ChunkProvider} source in context (via {@link useChunk}).
   */
  config: ClientChunkConfig<T, P, O>;
  props: ChunkComponentProps<T, P, O>;
}

/**
 * The client-loading half of {@link createCoordinatedLazy}: loads the piece's
 * data on the client via {@link useChunk}, shows `ChunkLoading` until it is
 * ready, then swaps to `ChunkContent` through {@link CoordinatedLazy}. The
 * isomorphic router renders this only for the client-driven render modes, so the
 * content/loading components here are always client components.
 */
export function CoordinatedLazyClient<T extends {}, P, O>(
  props: CoordinatedLazyClientProps<T, P, O>,
): JSX.Element {
  const ChunkContent = createMemo(() => props.config.ChunkContent);
  const ChunkLoading = createMemo(() => props.config.ChunkLoading ?? RenderNull);
  const _useChunk = useChunk(
    () => props.config,
    () => props.props,
  );
  const _useChunk2 = createMemo(() => {
    const { data, loading, revalidating, refresh } = _useChunk();
    return {
      data,
      loading,
      revalidating,
      refresh,
    };
  });
  const userProps = createMemo(() => (props.props.userProps ?? {}) as T);

  // Spreading the generic `T` alongside the fixed fields needs an assertion; the
  // shape matches `ChunkContentProps<T, P>` / `ChunkLoadingProps<T, P>`. The
  // content also receives `refresh`/`revalidating` so it can trigger a
  // stale-while-revalidate reload.
  const contentProps = createMemo(
    () =>
      ({
        ...userProps(),
        data: _useChunk2().data,
        loading: false,
        refresh: _useChunk2().refresh,
        revalidating: _useChunk2().revalidating,
      }) as ChunkContentProps<T, P>,
  );
  const loadingProps = createMemo(
    () =>
      ({
        ...userProps(),
        data: _useChunk2().data,
        loading: true,
      }) as ChunkLoadingProps<T, P>,
  );

  // `gate` is left to `CoordinatedLazy`: an explicit `props.gate` wins, otherwise
  // it registers with the ambient controller gate (if any).
  return (
    <CoordinatedLazy
      ready={!_useChunk2().loading}
      defer={props.config.swap?.defer}
      requireHoist={props.config.swap?.requireHoist}
      gate={props.props.gate}
      content={element(() => (
        <Dynamic component={ChunkContent()} {...contentProps()} />
      ))}
      fallback={element(() => (
        <Dynamic component={ChunkLoading()} {...loadingProps()} />
      ))}
    />
  );
}
