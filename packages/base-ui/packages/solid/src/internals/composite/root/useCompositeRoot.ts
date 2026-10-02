/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createSignal, untrack } from 'solid-js';
import type { TextDirection } from '../../../direction-provider/DirectionContext';
import { access, createDepsRenderEffect, type MaybeAccessor } from '../../../solid-helpers';
import { isElementDisabled } from '../../../utils/isElementDisabled';
import { EMPTY_ARRAY } from '../../../utils/constants';
import type { HTMLProps } from '../../../utils/types';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  COMPOSITE_KEYS,
  END,
  HOME,
  MODIFIER_KEYS,
  findNonDisabledListIndex,
  getMaxListIndex,
  getMinListIndex,
  isIndexOutOfListBounds,
  isListIndexDisabled,
  isNativeInput,
  scrollIntoViewIfNeeded,
  type ModifierKey,
} from '../composite';
import { ACTIVE_COMPOSITE_ITEM } from '../constants';
import type { CompositeList, CompositeMetadata } from '../list/CompositeList';
import { getTarget } from '../../../floating-ui-solid/utils';
import type { CompositeGridNavigator } from './gridNavigation';

// Solid: a `{ current }` holder stands in for React's ref object.
export interface CompositeElementsRef {
  readonly current: Array<HTMLElement | null | undefined>;
}

export interface UseCompositeRootParameters {
  orientation?: MaybeAccessor<'horizontal' | 'vertical' | 'both' | undefined>;
  grid?: MaybeAccessor<CompositeGridNavigator | undefined>;
  loopFocus?: MaybeAccessor<boolean | undefined>;
  onLoop?:
    | ((
        event: KeyboardEvent,
        prevIndex: number,
        nextIndex: number,
        elementsRef: CompositeElementsRef,
      ) => number)
    | undefined;
  highlightedIndex?: MaybeAccessor<number | undefined>;
  onHighlightedIndexChange?: ((index: number) => void) | undefined;
  direction: MaybeAccessor<TextDirection>;
  rootRef?: { current: HTMLElement | null | undefined } | undefined;
  /**
   * When `true`, pressing the Home key moves focus to the first item,
   * and pressing the End key moves focus to the last item.
   * @default false
   */
  enableHomeAndEndKeys?: MaybeAccessor<boolean | undefined>;
  /**
   * When `true`, keypress events on Composite's navigation keys
   * be stopped with event.stopPropagation().
   * @default false
   */
  stopEventPropagation?: MaybeAccessor<boolean | undefined>;
  /**
   * Array of item indices to be considered disabled.
   * Used for composite items that are focusable when disabled.
   */
  disabledIndices?: MaybeAccessor<number[] | undefined>;
  /**
   * Array of [modifier key values](https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values#modifier_keys) that should allow normal keyboard actions
   * when pressed. By default, all modifier keys prevent normal actions.
   * @default []
   */
  modifierKeys?: MaybeAccessor<ModifierKey[] | undefined>;
}

export function useCompositeRoot<Metadata = any>(params: UseCompositeRootParameters) {
  // Solid: parameters are read when used, so handlers see the latest values.
  const loopFocus = () => access(params.loopFocus) ?? true;
  const orientation = () => access(params.orientation) ?? 'both';
  const grid = () => access(params.grid);
  const direction = () => access(params.direction);
  const externalHighlightedIndex = () => access(params.highlightedIndex);
  const enableHomeAndEndKeys = () => access(params.enableHomeAndEndKeys) ?? false;
  const stopEventPropagation = () => access(params.stopEventPropagation);
  const disabledIndices = () => access(params.disabledIndices);
  const modifierKeys = () => access(params.modifierKeys) ?? (EMPTY_ARRAY as ModifierKey[]);

  const [internalHighlightedIndex, internalSetHighlightedIndex] = createSignal(0);
  const isGrid = () => grid() != null;

  let rootElement: HTMLElement | null | undefined = null;
  const setRootRef = (element: HTMLElement | null | undefined) => {
    rootElement = element;
    if (params.rootRef) {
      params.rootRef.current = element;
    }
  };

  // Solid: CompositeList fills these arrays in place.
  const refs: CompositeList.Props<Metadata>['refs'] = {
    elements: [],
    labels: [],
  };
  const elementsRef: CompositeElementsRef = {
    get current() {
      return refs.elements;
    },
  };
  let hasSetDefaultIndexRef = false;
  let highlightedElementRef: HTMLElement | null | undefined = null;

  const highlightedIndex = () => externalHighlightedIndex() ?? internalHighlightedIndex();
  const onHighlightedIndexChange = (index: number, shouldScrollIntoView = false) => {
    highlightedElementRef = elementsRef.current[index] ?? null;
    (params.onHighlightedIndexChange ?? internalSetHighlightedIndex)(index);
    if (shouldScrollIntoView) {
      const newActiveItem = elementsRef.current[index];
      scrollIntoViewIfNeeded(rootElement, newActiveItem, direction(), orientation());
    }
  };

  // Solid: CompositeList reports the sorted items as an array instead of a Map.
  const onMapChange = (map: Array<{ element: Element; metadata: CompositeMetadata<any> | null }>) =>
    untrack(() => {
      if (map.length === 0) {
        return;
      }

      const currentHighlightedIndex = highlightedIndex();
      const currentDisabledIndices = disabledIndices();

      if (hasSetDefaultIndexRef) {
        const elements = elementsRef.current;
        // Items added or removed around the highlighted one shift its index, so the tab stop would
        // otherwise move to a different item and navigation would resume from the wrong position.
        const nextIndex = elements.indexOf(highlightedElementRef ?? null);

        if (nextIndex === -1) {
          // A replacement at the same index can keep the tab stop. Otherwise move it to an
          // eligible item so a missing, hidden, or disabled replacement does not take the
          // composite out of the tab order.
          const replacement = elements[currentHighlightedIndex];
          if (
            !replacement ||
            isListIndexDisabled(elements, currentHighlightedIndex, currentDisabledIndices)
          ) {
            onHighlightedIndexChange(getFallbackIndex(elements, currentDisabledIndices));
          } else {
            highlightedElementRef = replacement;
          }
        } else if (nextIndex !== currentHighlightedIndex) {
          onHighlightedIndexChange(nextIndex);
        }
        return;
      }

      hasSetDefaultIndexRef = true;

      const sortedElements = map.map((item) => item.element) as Array<HTMLElement | null>;
      const activeItem =
        sortedElements.find((compositeElement) =>
          compositeElement?.hasAttribute(ACTIVE_COMPOSITE_ITEM),
        ) ?? null;
      // Set the default highlighted index of an arbitrary composite item. The map value carries
      // the item's own index, which is not its position among the keys once a list mixes explicit
      // and automatic indexes and leaves gaps.
      const activeIndex = activeItem
        ? (map.find((item) => item.element === activeItem)?.metadata?.index ?? -1)
        : -1;

      if (activeIndex !== -1) {
        onHighlightedIndexChange(activeIndex);
      } else if (
        isListIndexDisabled(sortedElements, currentHighlightedIndex, currentDisabledIndices)
      ) {
        // The default highlighted item is disabled, so it should not hold the single
        // roving tab stop: a natively disabled element is removed from the tab order,
        // and an aria-disabled one should not be the entry point. Move the tab stop
        // to the first enabled item. If every item is disabled, keep the current
        // highlighted index.
        const firstEnabledIndex = findNonDisabledListIndex(sortedElements, {
          disabledIndices: currentDisabledIndices,
        });
        if (!isIndexOutOfListBounds(sortedElements, firstEnabledIndex)) {
          onHighlightedIndexChange(firstEnabledIndex);
        }
      }

      scrollIntoViewIfNeeded(rootElement, activeItem, direction(), orientation());
    });

  createDepsRenderEffect(
    () => ({
      disabledIndices: disabledIndices(),
      externalHighlightedIndex: externalHighlightedIndex(),
      highlightedIndex: highlightedIndex(),
    }),
    (deps) => {
      // `disabledIndices` can resolve a render after the initial map population
      // (e.g. Toolbar derives it from item metadata through a state update), so the
      // default tab stop at index 0 may now point at a disabled item, leaving the
      // composite without a reachable tab stop. Re-validate and move it to the first
      // enabled item. Gated on `disabledIndices` being provided so composites that
      // rely on the DOM disabled fallback keep their existing behavior.
      if (
        deps.disabledIndices == null ||
        deps.externalHighlightedIndex != null ||
        !hasSetDefaultIndexRef
      ) {
        return;
      }
      const elements = elementsRef.current;
      if (isListIndexDisabled(elements, deps.highlightedIndex, deps.disabledIndices)) {
        const firstEnabledIndex = findNonDisabledListIndex(elements, {
          disabledIndices: deps.disabledIndices,
        });
        if (!isIndexOutOfListBounds(elements, firstEnabledIndex)) {
          onHighlightedIndexChange(firstEnabledIndex);
        }
      }
    },
  );

  const wrappedOnLoop = (event: KeyboardEvent, prevIndex: number, nextIndex: number) => {
    if (!params.onLoop) {
      return nextIndex;
    }
    return params.onLoop(event, prevIndex, nextIndex, elementsRef);
  };

  // Solid: a plain closure is stable, so `relayKeyboardEvent` keeps its identity.
  const onKeyDown = (event: KeyboardEvent) =>
    untrack(() => {
      const isHomeOrEnd = event.key === HOME || event.key === END;
      if (!COMPOSITE_KEYS.has(event.key) || (!enableHomeAndEndKeys() && isHomeOrEnd)) {
        return;
      }

      if (isModifierKeySet(event, modifierKeys())) {
        return;
      }

      const element = rootElement;
      if (!element) {
        return;
      }

      const orientationValue = orientation();
      const loopFocusValue = loopFocus();
      const currentDisabledIndices = disabledIndices();
      const currentHighlightedIndex = highlightedIndex();
      const isRtl = direction() === 'rtl';

      const horizontalForwardKey = isRtl ? ARROW_LEFT : ARROW_RIGHT;
      const horizontalBackwardKey = isRtl ? ARROW_RIGHT : ARROW_LEFT;
      const forwardKey = orientationValue === 'vertical' ? ARROW_DOWN : horizontalForwardKey;
      const backwardKey = orientationValue === 'vertical' ? ARROW_UP : horizontalBackwardKey;

      const target = getTarget(event);
      if (target != null && isNativeInput(target) && !isElementDisabled(target)) {
        const selectionStart = target.selectionStart;
        const selectionEnd = target.selectionEnd;
        const textContent = target.value;
        // return to native textbox behavior when
        // 1 - Shift is held to make a text selection, or if there already is a text selection
        if (selectionStart == null || event.shiftKey || selectionStart !== selectionEnd) {
          return;
        }
        // 2 - arrow-ing forward and not in the last position of the text
        if (event.key !== backwardKey && selectionStart < textContent.length) {
          return;
        }
        // 3 -arrow-ing backward and not in the first position of the text
        if (event.key !== forwardKey && selectionStart > 0) {
          return;
        }
      }

      let nextIndex = currentHighlightedIndex;
      const minIndex = getMinListIndex(elementsRef.current, currentDisabledIndices);
      const maxIndex = getMaxListIndex(elementsRef.current, currentDisabledIndices);

      const gridNavigator = grid();
      if (gridNavigator != null) {
        nextIndex = gridNavigator({
          disabledIndices: currentDisabledIndices,
          elementsRef,
          event,
          highlightedIndex: currentHighlightedIndex,
          loopFocus: loopFocusValue,
          maxIndex,
          minIndex,
          onLoop: wrappedOnLoop,
          orientation: orientationValue,
          rtl: isRtl,
        });
      }

      const isForwardKey =
        (orientationValue !== 'vertical' && event.key === horizontalForwardKey) ||
        (orientationValue !== 'horizontal' && event.key === ARROW_DOWN);
      const isBackwardKey =
        (orientationValue !== 'vertical' && event.key === horizontalBackwardKey) ||
        (orientationValue !== 'horizontal' && event.key === ARROW_UP);

      if (enableHomeAndEndKeys()) {
        if (event.key === HOME) {
          nextIndex = minIndex;
        } else if (event.key === END) {
          nextIndex = maxIndex;
        }
      }

      if (nextIndex === currentHighlightedIndex && (isForwardKey || isBackwardKey)) {
        if (loopFocusValue && nextIndex === maxIndex && isForwardKey) {
          nextIndex = minIndex;
          if (params.onLoop) {
            nextIndex = params.onLoop(event, currentHighlightedIndex, nextIndex, elementsRef);
          }
        } else if (loopFocusValue && nextIndex === minIndex && isBackwardKey) {
          nextIndex = maxIndex;
          if (params.onLoop) {
            nextIndex = params.onLoop(event, currentHighlightedIndex, nextIndex, elementsRef);
          }
        } else {
          nextIndex = findNonDisabledListIndex(elementsRef.current, {
            startingIndex: nextIndex,
            decrement: isBackwardKey,
            disabledIndices: currentDisabledIndices,
          });
        }
      }

      if (
        nextIndex !== currentHighlightedIndex &&
        !isIndexOutOfListBounds(elementsRef.current, nextIndex)
      ) {
        if (stopEventPropagation()) {
          event.stopPropagation();
        }

        if (isGrid() || isHomeOrEnd || isForwardKey || isBackwardKey) {
          event.preventDefault();
        }
        onHighlightedIndexChange(nextIndex, true);

        // Wait for FocusManager `returnFocus` to execute.
        queueMicrotask(() => {
          elementsRef.current[nextIndex]?.focus();
        });
      }
    });

  const props: HTMLProps = {
    // Solid: `focusin` bubbles from the items, as React's `onFocus` does.
    onFocusIn(event: FocusEvent) {
      const element = rootElement;
      const target = getTarget(event);
      if (!element || target == null || !isNativeInput(target)) {
        return;
      }
      target.setSelectionRange(0, target.value.length);
    },
    onKeyDown,
  };

  return {
    props,
    highlightedIndex,
    onHighlightedIndexChange,
    elementsRef,
    refs,
    setRootRef,
    onMapChange,
    relayKeyboardEvent: onKeyDown,
  };
}

// Resolves the item that should hold the tab stop: the active item when it can take focus,
// otherwise the first item that can. Falls back to index 0 so an all-disabled composite keeps the
// index in range and regains a tab stop as soon as one of its items becomes focusable.
function getFallbackIndex(
  elements: Array<HTMLElement | null | undefined>,
  disabledIndices?: number[],
) {
  let fallbackIndex = -1;

  for (let index = 0; index < elements.length; index += 1) {
    const element = elements[index];

    if (!element || isListIndexDisabled(elements, index, disabledIndices)) {
      continue;
    }

    if (element.hasAttribute(ACTIVE_COMPOSITE_ITEM)) {
      return index;
    }

    if (fallbackIndex === -1) {
      fallbackIndex = index;
    }
  }

  return Math.max(fallbackIndex, 0);
}

function isModifierKeySet(event: KeyboardEvent, ignoredModifierKeys: ModifierKey[]) {
  for (const key of MODIFIER_KEYS) {
    if (ignoredModifierKeys.includes(key)) {
      continue;
    }
    if (event.getModifierState(key)) {
      return true;
    }
  }
  return false;
}
