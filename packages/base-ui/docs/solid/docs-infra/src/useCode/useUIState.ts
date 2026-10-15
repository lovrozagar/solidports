import { createEffect, createMemo, createSignal, untrack } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import { useUrlHashState } from '../useUrlHashState';
import { isHashRelevantToDemo } from './useFileNavigation';

interface UseUIStateProps {
  initialExpanded?: boolean;
  initialDisabled?: boolean;
  mainSlug?: string;
  onExpand?: () => void;
}
export interface UseUIStateResult {
  expanded: boolean;
  expand: () => void;
  setExpanded: (value: boolean | ((prev: boolean) => boolean)) => void;
  editable: boolean;
  setEditable: (value: boolean | ((prev: boolean) => boolean)) => void;
}

/**
 * Hook for managing UI state like expansion and focus
 * Auto-expands if there's a relevant hash for this demo
 */
export function useUIState(_params: Accessor<UseUIStateProps>): Accessor<UseUIStateResult> {
  const _params2 = createMemo(() => {
    const { initialExpanded = false, initialDisabled = false, mainSlug, onExpand } = _params();
    return {
      mainSlug,
      onExpand,
      initialExpanded,
      initialDisabled,
    };
  });
  const _useUrlHashState = useUrlHashState();
  const _useUrlHashState2 = createMemo(() => {
    const [hash] = _useUrlHashState();
    return {
      hash,
    };
  });
  const hasRelevantHash = createMemo(() =>
    isHashRelevantToDemo(_useUrlHashState2().hash, _params2().mainSlug),
  );
  const [expanded, setExpanded] = createSignal(() =>
    untrack(() => initialState(_params2().initialExpanded || hasRelevantHash())),
  );
  const expand = () => setExpanded(true);

  // Edit-mode toggle. Starts on unless the block opted into `initialDisabled`; the host
  // exposes `setEditable` (gated on a controller) so a reader can flip read-only ↔ edit.
  const [editable, setEditable] = createSignal(() =>
    untrack(() => initialState(!_params2().initialDisabled)),
  );
  if (untrack(hasRelevantHash) && !untrack(expanded) && !untrack(_params2).onExpand) {
    setExpanded(true);
  }

  // Route post-mount deep links through the host's expansion policy. An initially
  // relevant hash is already represented by the state initializer above.
  createEffect(
    () => [expanded(), hasRelevantHash(), _params2().onExpand],
    () => {
      const _onExpand = _params2().onExpand;
      if (hasRelevantHash() && !expanded() && _onExpand) {
        _onExpand();
      }
    },
  );
  return createMemo(() => ({
    expanded: expanded(),
    expand,
    setExpanded,
    editable: editable(),
    setEditable,
  }));
}
