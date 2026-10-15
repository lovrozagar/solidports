import { element, place } from 'docs/src/adapters/react';
import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { CoordinatedLazyProps } from './types';
import { useCoordinatedSwap } from './useCoordinatedSwap';
import { CoordinatedFallbackContext } from './CoordinatedFallbackContext';
import { CoordinatedContentContext } from './CoordinatedContentContext';

/**
 * Show `fallback` until `ready` (and the page-coordinated swap conditions) are
 * met, then swap to `content`. The fallback is force-mounted once so its
 * `useCoordinatedFallback` hoist runs even when the content is precomputed; the
 * hoisted data is handed down to `content` via `useCoordinatedContent`.
 *
 * Generalizes the state-driven fallback<->content swap from
 * `CodeHighlighterClient`. Advanced consumers that need to fold the hoisted data
 * into their own `ready` computation should use {@link useCoordinatedSwap}
 * directly instead of this component.
 */
export function CoordinatedLazy(props: CoordinatedLazyProps): JSX.Element {
  const _useCoordinatedSwap = useCoordinatedSwap(() => ({
    ready: props.ready,
    defer: props.defer,
    holdGate: props.holdGate,
    hasFallback: props.fallback != null,
    skipFallback: props.skipFallback,
    requireHoist: props.requireHoist,
    awaitContent: props.awaitContent,
    gate: props.gate,
    data: props.data,
    preload: props.preload,
  }));
  const _useCoordinatedSwap2 = createMemo(() => {
    const { showFallback, fallbackContext, hoisted, reportContentReady } = _useCoordinatedSwap();
    return {
      showFallback,
      fallbackContext,
      hoisted,
      reportContentReady,
    };
  });
  // Forward `fallback` so a code-split `content` (e.g. `LazyContent`) can show
  // the same placeholder via `useCoordinatedContent().fallback` while its
  // dynamic import resolves - no empty flash on the content-side swap. In
  // `awaitContent` mode the fallback is already rendered alongside the content,
  // so the content must stay null while loading (no duplicate placeholder).
  const contentContext = createMemo(() => ({
    hoisted: _useCoordinatedSwap2().hoisted,
    reportReady: _useCoordinatedSwap2().reportContentReady,
    fallback: props.awaitContent ? undefined : props.fallback,
  }));
  const contentNode = element(() => (
    <CoordinatedContentContext value={contentContext}>{props.content}</CoordinatedContentContext>
  ));
  const fallbackNode = createMemo(() => {
    return _useCoordinatedSwap2().showFallback
      ? element(() => (
          <CoordinatedFallbackContext value={() => _useCoordinatedSwap2().fallbackContext}>
            {props.fallback}
          </CoordinatedFallbackContext>
        ))
      : null;
  });

  // awaitContent: mount the content behind the fallback so a code-split content
  // (e.g. `LazyContent`) loads in the background and reveals once it reports
  // ready. The content returns `null` until then, so only the fallback shows.
  const _render = createMemo(() => {
    if (props.awaitContent) {
      return (
        <>
          {fallbackNode()}
          {place(contentNode)}
        </>
      );
    }

    // Default: show the fallback OR the content (the content only mounts once the
    // swap commits to it).
    return _useCoordinatedSwap2().showFallback ? (
      <CoordinatedFallbackContext value={() => _useCoordinatedSwap2().fallbackContext}>
        {props.fallback}
      </CoordinatedFallbackContext>
    ) : (
      contentNode
    );
  });
  return <>{_render()}</>;
}
