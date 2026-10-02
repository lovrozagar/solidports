import { createMemo, untrack } from 'solid-js';
import { createDepsRenderEffect, defaultProps } from '../../solid-helpers';
import { EMPTY_ARRAY } from '../../utils/constants';
import { useTimeout } from '../../utils/useTimeout';
import { isElementVisible, isListIndexDisabled, type DisabledIndices } from '../utils/composite';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import { contains } from '../utils/element';
import { stopEvent } from '../utils/event';

export interface UseTypeaheadProps {
  /**
   * A ref which contains an array of strings whose indices match the HTML
   * elements of the list.
   * Solid: the list itself, read through a getter.
   * @default empty list
   */
  listRef: Array<string | null>;
  /**
   * The index of the active (focused or highlighted) item in the list.
   * @default null
   */
  activeIndex: number | null;
  /**
   * Callback invoked with the matching index if found as the user types.
   */
  onMatch?: ((index: number) => void) | undefined;
  /**
   * Optional list of item elements that correspond to `listRef` indices.
   * When an element exists for an index, typeahead skips it if it is hidden by
   * `display: none`, `visibility: hidden|collapse`, other browser-reported
   * visibility checks, or native disabled state.
   */
  elementsRef?: Array<HTMLElement | null | undefined> | undefined;
  /**
   * Indices that are disabled, either as an array or a predicate (the same shape as
   * `useListNavigation`'s `disabledIndices`). Disabled items are skipped while matching,
   * so a single keypress advances to the next selectable item (matching native `<select>`
   * and arrow-key navigation). The explicit disabled check doesn't read `elementsRef`, so
   * consumers whose items stay mounted-but-hidden while closed can still skip disabled items
   * without passing `elementsRef`.
   */
  disabledIndices?: DisabledIndices | undefined;
  /**
   * Callback invoked with the current typing activity as the user types.
   */
  onTyping?: ((isTyping: boolean) => void) | undefined;
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The number of milliseconds to wait before resetting the typed string.
   * @default 750
   */
  resetMs?: number | undefined;
  /**
   * The index of the selected item in the list, if available.
   * @default null
   */
  selectedIndex?: number | null | undefined;
}

/**
 * Provides a matching callback that can be used to focus an item as the user
 * types, often used in tandem with `useListNavigation()`.
 * @see https://floating-ui.com/docs/useTypeahead
 */
// Solid: takes `{ context, props }` and reads `props` lazily, so handlers see the latest values.
export function useTypeahead(parameters: {
  context: FloatingRootContext | FloatingContext;
  props: UseTypeaheadProps;
}): ElementProps {
  const props = defaultProps(parameters.props, {
    enabled: true,
    resetMs: 750,
    selectedIndex: null,
  });

  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;

  const open = createMemo(() => store().select('open'));

  const timeout = useTimeout();
  let stringRef = '';
  let prevIndexRef: number | null = untrack(() => props.selectedIndex ?? props.activeIndex ?? -1);
  let matchIndexRef: number | null = null;

  const onKeyDown = (event: KeyboardEvent) =>
    untrack(() => {
      const elementsRef = props.elementsRef;
      const disabledIndices = props.disabledIndices;
      const onTyping = props.onTyping;
      const activeIndex = props.activeIndex;
      const selectedIndex = props.selectedIndex;

      function getElement(index: number) {
        return elementsRef?.[index];
      }

      function isItemAvailable(index: number) {
        const element = getElement(index);
        if ((element && !isElementVisible(element)) || element?.matches(':disabled')) {
          return false;
        }
        // Visibility and native disabled state are handled above; pass an empty
        // element list so `isListIndexDisabled` resolves only the explicit
        // `disabledIndices` (array/predicate) and skips its own fallbacks.
        // Consumers that don't pass `disabledIndices` keep matching every visible
        // item except native disabled elements provided through `elementsRef`.
        return disabledIndices == null || !isListIndexDisabled(EMPTY_ARRAY, index, disabledIndices);
      }

      function getMatchingIndex(list: Array<string | null>, string: string, startIndex = 0) {
        if (list.length === 0) {
          return -1;
        }

        const normalizedStartIndex = ((startIndex % list.length) + list.length) % list.length;
        const lowerString = string.toLowerCase();

        for (let offset = 0; offset < list.length; offset += 1) {
          const index = (normalizedStartIndex + offset) % list.length;
          const text = list[index];
          if (!text?.toLowerCase().startsWith(lowerString) || !isItemAvailable(index)) {
            continue;
          }
          return index;
        }
        return -1;
      }

      const listContent = props.listRef;

      if (stringRef.length > 0 && event.key === ' ') {
        // Space should continue the in-progress typeahead session.
        stopEvent(event);
        onTyping?.(true);
      }

      if (stringRef.length > 0 && stringRef[0] !== ' ') {
        if (getMatchingIndex(listContent, stringRef) === -1 && event.key !== ' ') {
          onTyping?.(false);
        }
      }

      if (
        listContent == null ||
        // Character key.
        event.key.length !== 1 ||
        // Modifier key.
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }

      if (open() && event.key !== ' ') {
        stopEvent(event);
        onTyping?.(true);
      }

      // Capture whether this is a new typing session before mutating the string.
      const isNewSession = stringRef === '';
      if (isNewSession) {
        prevIndexRef = selectedIndex ?? activeIndex ?? -1;
      }

      // Bail out if the list contains a word like "llama" or "aaron". TODO:
      // allow it in this case, too. Unavailable items are skipped while matching, so
      // they must be ignored here as well — otherwise a hidden or disabled double-letter
      // label would block rapid cycling through the available items.
      const allowRapidSuccessionOfFirstLetter = listContent.every((text, index) =>
        text && isItemAvailable(index) ? text[0]?.toLowerCase() !== text[1]?.toLowerCase() : true,
      );

      // Allows the user to cycle through items that start with the same letter
      // in rapid succession.
      if (allowRapidSuccessionOfFirstLetter && stringRef === event.key) {
        stringRef = '';
        prevIndexRef = matchIndexRef;
      }

      stringRef += event.key;
      timeout.start(props.resetMs, () => {
        stringRef = '';
        prevIndexRef = matchIndexRef;
        untrack(() => props.onTyping)?.(false);
      });

      // Compute the starting index for this search.
      // If this is a new typing session (string is empty), base it on the current
      // selection/active item; otherwise continue from the last matched index.
      const prevIndex = isNewSession ? (selectedIndex ?? activeIndex ?? -1) : prevIndexRef;
      const startIndex = (prevIndex ?? 0) + 1;

      const index = getMatchingIndex(listContent, stringRef, startIndex);

      if (index !== -1) {
        props.onMatch?.(index);
        matchIndexRef = index;
      } else if (event.key !== ' ') {
        stringRef = '';
        onTyping?.(false);
      }
    });

  const onBlur = (event: FocusEvent) =>
    untrack(() => {
      const next = event.relatedTarget as Element | null;
      const currentDomReferenceElement = store().select('domReferenceElement');
      const currentFloatingElement = store().select('floatingElement');
      const withinComposite =
        contains(currentDomReferenceElement, next) || contains(currentFloatingElement, next);

      // Keep the session if focus moves within the composite (reference <-> floating).
      if (withinComposite) {
        return;
      }

      // End the current typing session when focus leaves the composite entirely.
      timeout.clear();
      stringRef = '';
      prevIndexRef = matchIndexRef;
      props.onTyping?.(false);
    });

  // Layout-effect timing, as React's `useIsoLayoutEffect`.
  createDepsRenderEffect(
    () => ({ open: open(), selectedIndex: props.selectedIndex }),
    (deps) => {
      if (!deps.open && deps.selectedIndex !== null) {
        return;
      }

      timeout.clear();
      matchIndexRef = null;

      if (stringRef !== '') {
        stringRef = '';
      }
    },
  );

  const sharedProps = { onKeyDown, onBlur };

  return {
    get reference() {
      return props.enabled ? sharedProps : undefined;
    },
    get floating() {
      return props.enabled ? sharedProps : undefined;
    },
  };
}
