/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { isHTMLElement } from '@floating-ui/utils/dom';
import { createMemo, createRenderEffect, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  createDepsRenderEffect,
  createDepsEffect,
  access,
  defaultProps,
  useRef,
} from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerDocument } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { useFloatingParentNodeId, useFloatingTreeAccessor } from '../components/FloatingTree';
import { FloatingTreeStore } from '../components/FloatingTreeStore';
import type { ElementProps, FloatingContext, FloatingRootContext } from '../types';
import {
  activeElement,
  contains,
  findNonDisabledListIndex,
  getFloatingFocusElement,
  getMaxListIndex,
  getMinListIndex,
  getTarget,
  isIndexOutOfListBounds,
  isTypeableCombobox,
  isVirtualClick,
  isVirtualPointerEvent,
  stopEvent,
} from '../utils';
import { ARROW_DOWN, ARROW_LEFT, ARROW_RIGHT, ARROW_UP } from '../utils/constants';
import { enqueueFocus } from '../utils/enqueueFocus';
import { platform } from '../../utils/platform';
import type { gridNavigation } from './gridNavigation';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

export const ESCAPE = 'Escape';

// WebKit fires zero-delta `mousemove`/`pointermove` events when the list scrolls
// beneath a stationary pointer, moving the highlight during keyboard navigation.
// https://github.com/mui/base-ui/issues/4002
function isStationaryWebKitPointer(event: MouseEvent | PointerEvent) {
  return platform.engine.webkit && event.movementX === 0 && event.movementY === 0;
}

function doSwitch(
  orientation: UseListNavigationProps['orientation'],
  vertical: boolean,
  horizontal: boolean,
) {
  switch (orientation) {
    case 'vertical':
      return vertical;
    case 'horizontal':
      return horizontal;
    default:
      return vertical || horizontal;
  }
}

function isMainOrientationKey(key: string, orientation: UseListNavigationProps['orientation']) {
  const vertical = key === ARROW_UP || key === ARROW_DOWN;
  const horizontal = key === ARROW_LEFT || key === ARROW_RIGHT;
  return doSwitch(orientation, vertical, horizontal);
}

function isMainOrientationToEndKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = key === ARROW_DOWN;
  const horizontal = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  return (
    doSwitch(orientation, vertical, horizontal) || key === 'Enter' || key === ' ' || key === ''
  );
}

function isCrossOrientationOpenKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
) {
  const vertical = rtl ? key === ARROW_LEFT : key === ARROW_RIGHT;
  const horizontal = key === ARROW_DOWN;
  return doSwitch(orientation, vertical, horizontal);
}

function isCrossOrientationCloseKey(
  key: string,
  orientation: UseListNavigationProps['orientation'],
  rtl: boolean,
  grid: boolean,
) {
  const vertical = rtl ? key === ARROW_RIGHT : key === ARROW_LEFT;
  const horizontal = key === ARROW_UP;
  if (orientation === 'both' || (orientation === 'horizontal' && grid)) {
    return key === ESCAPE;
  }
  return doSwitch(orientation, vertical, horizontal);
}

export interface UseListNavigationProps {
  /**
   * A ref that holds an array of list items.
   * @default empty list
   */
  listRef: Array<HTMLElement | null | undefined>;
  /**
   * The index of the currently active (focused or highlighted) item, which may
   * or may not be selected.
   * @default null
   */
  activeIndex: number | null;
  /**
   * A callback that is called when the user navigates to a new active item,
   * passed in a new `activeIndex`.
   */
  onNavigate?: ((activeIndex: number | null, event: Event | undefined) => void) | undefined;
  /**
   * Whether the Hook is enabled, including all internal Effects and event
   * handlers.
   * @default true
   */
  enabled?: boolean | undefined;
  /**
   * The currently selected item index, which may or may not be active.
   * @default null
   */
  selectedIndex?: number | null | undefined;
  /**
   * Whether to focus the item upon opening the floating element. 'auto' infers
   * what to do based on the input type (keyboard vs. pointer), while a boolean
   * value will force the value.
   * @default 'auto'
   */
  focusItemOnOpen?: boolean | 'auto' | undefined;
  /**
   * Whether hovering an item synchronizes the focus.
   * @default true
   */
  focusItemOnHover?: boolean | undefined;
  /**
   * Whether pressing an arrow key on the navigation’s main axis opens the
   * floating element.
   * @default true
   */
  openOnArrowKeyDown?: boolean | undefined;
  /**
   * By default elements with either a `disabled` or `aria-disabled` attribute
   * are skipped in the list navigation — however, this requires the items to
   * be rendered.
   * This prop allows you to manually specify indices which should be disabled,
   * overriding the default logic.
   * For Windows-style select popups, where the menu does not open when
   * navigating via arrow keys, specify an empty array.
   * @default undefined
   */
  disabledIndices?: ReadonlyArray<number> | ((index: number) => boolean) | undefined;
  /**
   * Determines whether focus can escape the list, such that nothing is selected
   * after navigating beyond the boundary of the list. In some
   * autocomplete/combobox components, this may be desired, as screen
   * readers will return to the input.
   * `loop` must be `true`.
   * @default false
   */
  allowEscape?: boolean | undefined;
  /**
   * Determines whether focus should loop around when navigating past the first
   * or last item.
   * @default false
   */
  loopFocus?: boolean | undefined;
  /**
   * If the list is nested within another one (e.g. a nested submenu), the
   * navigation semantics change.
   * @default false
   */
  nested?: boolean | undefined;
  /**
   * Allows to specify the orientation of the parent list, which is used to
   * determine the direction of the navigation.
   * This is useful when list navigation is used within a Composite,
   * as the hook can't determine the orientation of the parent list automatically.
   */
  parentOrientation?: UseListNavigationProps['orientation'] | undefined;
  /**
   * Whether the direction of the floating element’s navigation is in RTL
   * layout.
   * @default false
   */
  rtl?: boolean | undefined;
  /**
   * Whether the focus is virtual (using `aria-activedescendant`).
   * Use this if you need focus to remain on the reference element
   * (such as an input), but allow arrow keys to navigate list items.
   * This is common in autocomplete listbox components.
   * Your virtually-focused list items must have a unique `id` set on them.
   * If you’re using a component role with the `useRole()` Hook, then an `id` is
   * generated automatically.
   * @default false
   */
  virtual?: boolean | undefined;
  /**
   * The orientation in which navigation occurs.
   * @default 'vertical'
   */
  orientation?: 'vertical' | 'horizontal' | 'both' | undefined;
  /**
   * The id of the root component.
   */
  id?: string | undefined;
  /**
   * Whether to clear the active index when the pointer leaves an item.
   * @default true
   */
  resetOnPointerLeave?: boolean | undefined;
  /**
   * External FlatingTree to use when the one provided by context can't be used.
   */
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Computes two-dimensional list navigation for grid-capable consumers.
   */
  grid?: typeof gridNavigation | null | undefined;
}

/**
 * Adds arrow key-based navigation of a list of items, either using real DOM
 * focus or virtual focus.
 * @see https://floating-ui.com/docs/useListNavigation
 */
export function useListNavigation(parameters: {
  context: FloatingRootContext | FloatingContext;
  props: UseListNavigationProps;
}): ElementProps {
  const store = () =>
    'rootStore' in parameters.context ? parameters.context.rootStore : parameters.context;
  const open = createMemo(() => store().select('open'));
  const floatingElement = createMemo(() => store().select('floatingElement'));
  const domReferenceElement = createMemo(() => store().select('domReferenceElement'));
  const dataRef = () => store().context.dataRef;

  const props = defaultProps(parameters.props, {
    allowEscape: false,
    disabledIndices: undefined,
    enabled: true,
    focusItemOnHover: true,
    focusItemOnOpen: 'auto',
    loopFocus: false,
    nested: false,
    openOnArrowKeyDown: true,
    orientation: 'vertical',
    resetOnPointerLeave: true,
    rtl: false,
    selectedIndex: null,
    virtual: false,
  });
  const activeIndex = () => parameters.props.activeIndex;
  const hasMountedList = () => props.listRef.some((item) => item != null);

  if (process.env.NODE_ENV !== 'production') {
    createDepsEffect(
      () => ({
        allowEscape: props.allowEscape,
        loopFocus: props.loopFocus,
        virtual: props.virtual,
        orientation: props.orientation,
        isGrid: props.grid != null,
      }),
      (deps) => {
        if (deps.allowEscape) {
          if (!deps.loopFocus) {
            console.warn('`useListNavigation` looping must be enabled to allow escaping.');
          }

          if (!deps.virtual) {
            console.warn('`useListNavigation` must be virtual to allow escaping.');
          }
        }

        if (deps.orientation === 'vertical' && deps.isGrid) {
          console.warn(
            'In grid list navigation mode, the `orientation` should',
            'be either "horizontal" or "both".',
          );
        }
      },
    );
  }

  const floatingFocusElement = () => getFloatingFocusElement(floatingElement());
  const floatingFocusElementRef = useRef<HTMLElement | null>(untrack(floatingFocusElement));

  const parentId = useFloatingParentNodeId();
  const getTree = useFloatingTreeAccessor(() => props.externalTree);

  createRenderEffect(
    () => [dataRef(), props.orientation] as const,
    ([data, orientation]) => {
      data.orientation = orientation;
    },
  );

  /**
   * TODO: this needs to be memoized as it causes an infinite loop
   * with the MenuRoot triggerElement assignement
   */
  const typeableComboboxReference = createMemo(() => isTypeableCombobox(domReferenceElement()));

  const focusItemOnOpenRef = useRef(untrack(() => props.focusItemOnOpen));
  const indexRef = useRef(untrack(() => props.selectedIndex ?? -1));
  const keyRef = useRef<null | string>(null);
  const isPointerModalityRef = useRef(true);

  // A user callback, invoked from effects and handlers: it reads state, it does not subscribe.
  const onNavigate = (event?: Event) => {
    untrack(() => props.onNavigate?.(indexRef.current === -1 ? null : indexRef.current, event));
  };

  const forceSyncFocusRef = useRef(false);
  const isMounted = () => !!floatingElement() || hasMountedList();
  const forceScrollIntoViewRef = useRef(false);
  const previousMountedRef = useRef(false);
  const previousOpenRef = useRef(false);
  const previousOnNavigateRef = useRef(onNavigate);
  const disabledIndicesRef = useRef(untrack(() => props.disabledIndices));
  const selectedIndexRef = useRef(untrack(() => props.selectedIndex));
  const resetOnPointerLeaveRef = useRef(untrack(() => props.resetOnPointerLeave));
  const cancelQueuedFocusRef = useRef<(() => void) | null>(null);

  function runFocus(item: HTMLElement) {
    if (props.virtual) {
      getTree()?.events.emit('virtualfocus', item);
    } else {
      cancelQueuedFocusRef.current = enqueueFocus(item, {
        preventScroll: true,
        sync: forceSyncFocusRef.current,
      });
    }
  }

  const focusItem = () => {
    const initialItem = props.listRef[indexRef.current];
    const forceScrollIntoView = forceScrollIntoViewRef.current;
    if (initialItem) {
      runFocus(initialItem);
    }

    const scheduler = forceSyncFocusRef.current ? (v: () => void) => v() : requestAnimationFrame;

    scheduler(() => {
      const waitedItem = props.listRef[indexRef.current] || initialItem;

      if (!waitedItem) {
        return;
      }

      if (!initialItem) {
        runFocus(waitedItem);
      }

      const shouldScrollIntoView =
        waitedItem && (forceScrollIntoView || !isPointerModalityRef.current);

      if (shouldScrollIntoView) {
        // JSDOM doesn't support `.scrollIntoView()` but it's widely supported
        // by all browsers.
        waitedItem.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
      }
    });
  };

  // Sync `selectedIndex` to be the `activeIndex` upon opening the floating
  // element. Also, reset `activeIndex` upon closing the floating element.
  createRenderEffect(
    () => {
      if (!props.enabled) {
        return { enabled: false as const };
      }
      return {
        enabled: true as const,
        isOpen: open(),
        mounted: isMounted(),
        currentActive: untrack(() => activeIndex()),
        selected: props.selectedIndex,
      };
    },
    (info) => {
      if (!info.enabled) {
        return;
      }

      if (info.isOpen && info.mounted) {
        if (info.currentActive != null) {
          return;
        }

        const selected = info.selected;
        indexRef.current = selected ?? -1;
        if (focusItemOnOpenRef.current && selected != null) {
          // Regardless of the pointer modality, we want to ensure the selected
          // item comes into view when the floating element is opened.
          forceScrollIntoViewRef.current = true;
          onNavigate();
        }
      } else if (previousMountedRef.current) {
        indexRef.current = -1;
        previousOnNavigateRef.current();
      }
    },
  );

  // Sync `activeIndex` to be the focused item while the floating element is
  // open.
  createDepsRenderEffect(
    () => ({
      enabled: props.enabled,
      isOpen: open(),
      mounted: isMounted(),
      idx: activeIndex(),
      orientation: props.orientation,
      rtl: props.rtl,
      nested: props.nested,
    }),
    (info) => {
      if (!info.enabled) {
        return;
      }

      if (!info.isOpen) {
        forceSyncFocusRef.current = false;
        return;
      }

      if (!info.mounted) {
        return;
      }

      const idx = info.idx;
      if (idx == null) {
        forceSyncFocusRef.current = false;

        if (selectedIndexRef.current != null) {
          return;
        }

        // Reset while the floating element was open (e.g. the list changed).
        if (previousMountedRef.current) {
          indexRef.current = -1;
          focusItem();
        }

        // Initial sync.
        if (
          (!previousOpenRef.current || !previousMountedRef.current) &&
          focusItemOnOpenRef.current &&
          (keyRef.current != null ||
            (focusItemOnOpenRef.current === true && keyRef.current == null))
        ) {
          let runs = 0;
          const maxRuns = 10;
          let deferredForVisibility = false;
          const orientationResolved = info.orientation;
          const rtlResolved = info.rtl;
          const nestedResolved = info.nested;
          const waitForListPopulated = () => {
            if (props.listRef[0] == null) {
              // Avoid letting the browser paint if possible on the first try,
              // otherwise use rAF.
              if (runs < maxRuns) {
                const scheduler = runs ? requestAnimationFrame : queueMicrotask;
                scheduler(waitForListPopulated);
              }
              runs += 1;
            } else {
              // initially focus the first non-disabled item
              const nextIndex =
                keyRef.current == null ||
                isMainOrientationToEndKey(keyRef.current, orientationResolved, rtlResolved) ||
                nestedResolved
                  ? getMinListIndex(props.listRef)
                  : getMaxListIndex(props.listRef);

              // Solid adaptation: this render effect can run before the positioner's DOM updates
              // (React's layout effect runs after the commit), so a keep-mounted popup may still be
              // `hidden` and every item look unavailable. Retry once the current flush has applied.
              if (isIndexOutOfListBounds(props.listRef, nextIndex) && !deferredForVisibility) {
                deferredForVisibility = true;
                queueMicrotask(waitForListPopulated);
                return;
              }

              // Solid adaptation: keep keyboard-open initial focus in the same task; deferred to a
              // frame, keyboard-opened submenus lose it in Solid. Pointer opens stay
              // frame-deferred, as React's.
              if (!isPointerModalityRef.current) {
                forceSyncFocusRef.current = true;
              }
              indexRef.current = nextIndex;
              keyRef.current = null;
              onNavigate();
            }
          };

          waitForListPopulated();
        }
      } else if (!isIndexOutOfListBounds(props.listRef, idx)) {
        indexRef.current = idx;
        focusItem();
        forceScrollIntoViewRef.current = false;
      } else if (!hasMountedList()) {
        // Solid adaptation: list items register in their own effects, after this one (React runs
        // the children's layout effects first). Sync once they have registered.
        queueMicrotask(() => {
          if (
            untrack(open) &&
            untrack(activeIndex) === idx &&
            !isIndexOutOfListBounds(props.listRef, idx)
          ) {
            indexRef.current = idx;
            focusItem();
            forceScrollIntoViewRef.current = false;
          }
        });
      }
    },
  );

  // Ensure the parent floating element has focus when a nested child closes
  // to allow arrow key navigation to work after the pointer leaves the child.
  createDepsRenderEffect(
    () => ({
      enabled: props.enabled,
      floating: floatingElement(),
      domReference: domReferenceElement(),
      virtual: props.virtual,
    }),
    (deps) => {
      const tree = getTree();
      if (!deps.enabled || deps.floating || !tree || deps.virtual || !previousMountedRef.current) {
        return;
      }

      const nodes = tree.nodesRef;
      const parentNode = nodes.find((node) => node.id === parentId);
      const parent = parentNode ? access(parentNode.context)?.elements.floating() : undefined;
      // `floating` is null here (see the guard above), so resolve the owner document from an
      // in-DOM element for realm-safety (shadow DOM/iframes): the reference element, falling back
      // to the parent floating element when the reference is virtual.
      const activeEl = activeElement(ownerDocument(deps.domReference ?? parent ?? null));
      const treeContainsActiveEl = nodes.some(
        (node) => node.context && contains(node.context.elements.floating(), activeEl),
      );

      if (parent && !treeContainsActiveEl && isPointerModalityRef.current) {
        parent.focus({ preventScroll: true });
      }
    },
  );

  // Remembers this pass's values for the next one (React's ref updates after the effects above).
  createDepsRenderEffect(
    () => ({
      floatingFocusElement: floatingFocusElement(),
      open: open(),
      mounted: isMounted(),
      disabledIndices: props.disabledIndices,
      selectedIndex: props.selectedIndex,
      resetOnPointerLeave: props.resetOnPointerLeave,
    }),
    (values) => {
      floatingFocusElementRef.current = values.floatingFocusElement;
      previousOnNavigateRef.current = onNavigate;
      previousOpenRef.current = values.open;
      previousMountedRef.current = values.mounted;
      disabledIndicesRef.current = values.disabledIndices;
      selectedIndexRef.current = values.selectedIndex;
      resetOnPointerLeaveRef.current = values.resetOnPointerLeave;
    },
  );

  createDepsRenderEffect(
    () => ({ open: open(), focusItemOnOpen: props.focusItemOnOpen }),
    (values) => {
      if (!values.open) {
        keyRef.current = null;
        focusItemOnOpenRef.current = values.focusItemOnOpen;
      }
    },
  );

  const hasActiveIndex = () => activeIndex() != null;

  function syncCurrentTarget(event: Event) {
    if (!open()) {
      return;
    }
    const index = props.listRef.indexOf(event.currentTarget as HTMLElement);
    if (index !== -1 && (indexRef.current !== index || activeIndex() !== index)) {
      indexRef.current = index;
      onNavigate(event);
    }
  }

  const item: ElementProps['item'] = {
    onFocus(event) {
      forceSyncFocusRef.current = true;
      syncCurrentTarget(event);
    },
    onClick: ({ currentTarget }) => currentTarget.focus({ preventScroll: true }), // Safari
    onMouseMove(event) {
      if (isStationaryWebKitPointer(event)) {
        return;
      }
      forceSyncFocusRef.current = true;
      forceScrollIntoViewRef.current = false;
      if (props.focusItemOnHover) {
        syncCurrentTarget(event);
      }
    },
    onPointerLeave(event) {
      if (!open() || !isPointerModalityRef.current || event.pointerType === 'touch') {
        return;
      }

      forceSyncFocusRef.current = true;

      const relatedTarget = event.relatedTarget as HTMLElement | null;

      if (!props.focusItemOnHover || props.listRef.includes(relatedTarget)) {
        return;
      }

      if (!resetOnPointerLeaveRef.current) {
        return;
      }

      cancelQueuedFocusRef.current?.();
      cancelQueuedFocusRef.current = null;

      indexRef.current = -1;
      onNavigate(event);

      if (!props.virtual) {
        const floatingFocusEl = floatingFocusElementRef.current;
        const activeEl = activeElement(ownerDocument(floatingFocusEl));
        if (floatingFocusEl && contains(floatingFocusEl, activeEl)) {
          floatingFocusEl.focus({ preventScroll: true });
        }
      }
    },
  };

  const getParentOrientation = () => {
    if (props.parentOrientation) {
      return props.parentOrientation;
    }

    const parentNode = getTree()?.nodesRef?.find((node) => node.id === parentId);
    return (
      (parentNode ? access(parentNode.context)?.dataRef?.orientation : undefined) ??
      props.orientation
    );
  };

  const getTriggerReference = () => {
    const domReference = domReferenceElement();
    if (isHTMLElement(domReference)) {
      return domReference;
    }

    const firstTrigger = store().context.triggerElements.elements().next();
    return !firstTrigger.done && isHTMLElement(firstTrigger.value) ? firstTrigger.value : null;
  };

  const commonOnKeyDown = (event: KeyboardEvent) => {
    isPointerModalityRef.current = false;
    forceSyncFocusRef.current = true;
    const floatingEl = floatingElement();

    // When composing a character, Chrome fires ArrowDown twice. Firefox/Safari
    // don't appear to suffer from this. `event.isComposing` is avoided due to
    // Safari not supporting it properly (although it's not needed in the first
    // place for Safari, just avoiding any possible issues).
    if (event.which === 229) {
      return;
    }

    // If the floating element is animating out, ignore navigation. Otherwise,
    // the `activeIndex` gets set to 0 despite not being open so the next time
    // the user ArrowDowns, the first item won't be focused.
    if (!open() && event.currentTarget === floatingEl && !dataRef().__closing) {
      return;
    }

    if (
      props.nested &&
      isCrossOrientationCloseKey(event.key, props.orientation, props.rtl, props.grid != null)
    ) {
      const domReference = getTriggerReference();
      const parentOrientation = getParentOrientation();
      const shouldLetParentNavigate = isMainOrientationKey(event.key, parentOrientation);

      // If the nested list's close key is also the parent navigation key,
      // let the parent navigate. Otherwise, stop propagating the event.
      if (!shouldLetParentNavigate) {
        stopEvent(event);

        if (dataRef().__closing) {
          event.stopImmediatePropagation();
          delete dataRef().__closing;
        }
      }

      if (shouldLetParentNavigate) {
        queueMicrotask(() => {
          store().setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));
        });
      } else {
        store().setOpen(false, createChangeEventDetails(REASONS.listNavigation, event));
      }

      if (!shouldLetParentNavigate && isHTMLElement(domReference)) {
        if (props.virtual) {
          getTree()?.events.emit('virtualfocus', domReference);
        } else {
          domReference.focus();
        }
      }

      return;
    }

    const currentIndex = indexRef.current;
    const minIndex = getMinListIndex(props.listRef, disabledIndicesRef.current);
    const maxIndex = getMaxListIndex(props.listRef, disabledIndicesRef.current);

    if (!typeableComboboxReference()) {
      if (event.key === 'Home') {
        stopEvent(event);
        indexRef.current = minIndex;
        onNavigate(event);
        if (!props.virtual) {
          focusItem();
        }
      }

      if (event.key === 'End') {
        stopEvent(event);
        indexRef.current = maxIndex;
        onNavigate(event);
        if (!props.virtual) {
          focusItem();
        }
      }
    }

    // Grid navigation is injected by grid-capable consumers so non-grid
    // consumers (menu, select) tree-shake the grid helpers out.
    const navigateGrid = props.grid;
    if (navigateGrid != null) {
      const index = navigateGrid(
        event,
        indexRef.current,
        props.listRef,
        props.orientation,
        props.loopFocus,
        props.rtl,
        disabledIndicesRef.current,
        minIndex,
        maxIndex,
      );

      if (index != null) {
        indexRef.current = index;
        onNavigate(event);
      }

      if (props.orientation === 'both') {
        return;
      }
    }

    if (isMainOrientationKey(event.key, props.orientation)) {
      stopEvent(event);

      // Reset the index if no item is focused.
      if (
        open() &&
        !props.virtual &&
        event.currentTarget === floatingEl &&
        activeElement((event.currentTarget as any)?.ownerDocument) === event.currentTarget
      ) {
        const newIndex = isMainOrientationToEndKey(event.key, props.orientation, props.rtl)
          ? minIndex
          : maxIndex;
        indexRef.current = newIndex;

        onNavigate(event);
        return;
      }

      if (isMainOrientationToEndKey(event.key, props.orientation, props.rtl)) {
        if (props.loopFocus) {
          if (currentIndex >= maxIndex) {
            if (props.allowEscape && currentIndex !== props.listRef.length) {
              indexRef.current = -1;
            } else {
              // Give time for virtualizers to update the listRef.
              forceSyncFocusRef.current = false;
              indexRef.current = minIndex;
            }
          } else {
            indexRef.current = findNonDisabledListIndex(props.listRef, {
              disabledIndices: disabledIndicesRef.current,
              startingIndex: currentIndex,
            });
          }
        } else {
          const newIndex = Math.min(
            maxIndex,
            findNonDisabledListIndex(props.listRef, {
              disabledIndices: disabledIndicesRef.current,
              startingIndex: currentIndex,
            }),
          );
          indexRef.current = newIndex;
        }
      } else if (props.loopFocus) {
        if (currentIndex <= minIndex) {
          if (props.allowEscape && currentIndex !== -1) {
            indexRef.current = props.listRef.length;
          } else {
            // Give time for virtualizers to update the listRef.
            forceSyncFocusRef.current = false;
            indexRef.current = maxIndex;
          }
        } else {
          indexRef.current = findNonDisabledListIndex(props.listRef, {
            decrement: true,
            disabledIndices: disabledIndicesRef.current,
            startingIndex: currentIndex,
          });
        }
      } else {
        const newIndex = Math.max(
          minIndex,
          findNonDisabledListIndex(props.listRef, {
            decrement: true,
            disabledIndices: disabledIndicesRef.current,
            startingIndex: currentIndex,
          }),
        );
        indexRef.current = newIndex;
      }

      if (isIndexOutOfListBounds(props.listRef, indexRef.current)) {
        indexRef.current = -1;
      }

      onNavigate(event);

      // Keep keyboard navigation focus updates in the same event cycle.
      if (!props.virtual) {
        focusItem();
      }
    }
  };

  const ariaActiveDescendantProp: JSX.HTMLAttributes<HTMLElement> = {
    get 'aria-activedescendant'() {
      return props.virtual && open() && hasActiveIndex()
        ? `${props.id}-${activeIndex()}`
        : undefined;
    },
  };

  const floating: ElementProps['floating'] = {
    get 'aria-activedescendant'() {
      if (typeableComboboxReference()) {
        return undefined;
      }

      return ariaActiveDescendantProp['aria-activedescendant'];
    },
    onKeyDown(event) {
      // Close submenu on Shift+Tab
      if (event.key === 'Tab' && event.shiftKey && open() && !props.virtual) {
        const domReference = getTriggerReference();

        // If the event originated from within a nested element (e.g., a Dialog opened from
        // within the menu), don't close the menu. The nested element has its own focus
        // management and should handle the Tab key.
        const target = getTarget(event) as Element | null;
        if (target && !contains(floatingFocusElement(), target)) {
          return;
        }

        stopEvent(event);
        store().setOpen(false, createChangeEventDetails(REASONS.focusOut, event));

        if (isHTMLElement(domReference)) {
          domReference.focus();
        }

        return;
      }

      commonOnKeyDown(event);

      // Manually bubble across portals only if propagation wasn't stopped
      // by commonOnKeyDown (mirrors React's natural bubbling behavior).
      if (parentId != null && !(event as any).cancelBubble) {
        const eventObject = new KeyboardEvent('keydown', { key: event.key });
        const parentNode =
          getTree() && parentId != null
            ? (getTree()?.nodesRef ?? []).find((node) => node.id === parentId)
            : null;

        if (parentNode) {
          parentNode.context?.elements.floating()?.dispatchEvent(eventObject);
        }
      }
    },
    onPointerMove(event) {
      if (isStationaryWebKitPointer(event)) {
        return;
      }
      isPointerModalityRef.current = true;
    },
  };

  // TODO: This is a hack to get the event type to work.
  function checkVirtualMouse(event: MouseEvent) {
    if (props.focusItemOnOpen === 'auto' && isVirtualClick(event)) {
      focusItemOnOpenRef.current = !props.virtual;
    }
  }

  function checkVirtualPointer(event: PointerEvent) {
    // `pointerdown` fires first, reset the state then perform the checks.
    focusItemOnOpenRef.current = props.focusItemOnOpen;
    if (props.focusItemOnOpen === 'auto' && isVirtualPointerEvent(event)) {
      focusItemOnOpenRef.current = true;
    }
  }

  const trigger: ElementProps['trigger'] = {
    onClick: checkVirtualMouse,
    onFocus(event) {
      if (store().select('open') && !props.virtual && activeIndex() == null) {
        indexRef.current = -1;
        onNavigate(event);
      }
    },
    onKeyDown(event) {
      // non-reactive open state (to prevent re-creation of the handler)
      const currentOpen = store().select('open');
      isPointerModalityRef.current = false;

      const isArrowKey = event.key.startsWith('Arrow');
      const isParentCrossOpenKey = isCrossOrientationOpenKey(
        event.key,
        getParentOrientation(),
        props.rtl,
      );
      const isMainKey = isMainOrientationKey(event.key, props.orientation);
      const isNavigationKey =
        (props.nested ? isParentCrossOpenKey : isMainKey) ||
        event.key === 'Enter' ||
        event.key.trim() === '';

      if (props.virtual && currentOpen) {
        return commonOnKeyDown(event);
      }

      // If a floating element should not open on arrow key down, avoid
      // setting `activeIndex` while it's closed.
      if (!currentOpen && !props.openOnArrowKeyDown && isArrowKey) {
        return undefined;
      }

      if (isNavigationKey) {
        const isParentMainKey = isMainOrientationKey(event.key, getParentOrientation());
        keyRef.current = props.nested && isParentMainKey ? null : event.key;
      }

      if (props.nested) {
        if (isParentCrossOpenKey) {
          stopEvent(event);

          if (currentOpen) {
            const newIndex = getMinListIndex(props.listRef, disabledIndicesRef.current);
            indexRef.current = newIndex;
            onNavigate(event);
          } else {
            store().setOpen(
              true,
              createChangeEventDetails(
                REASONS.listNavigation,
                event,
                event.currentTarget as HTMLElement,
              ),
            );
          }
        }

        return undefined;
      }

      if (isMainKey) {
        const selected = selectedIndexRef.current;
        if (selected != null) {
          indexRef.current = selected;
        }

        stopEvent(event);

        if (!currentOpen && props.openOnArrowKeyDown) {
          /**
           * This will cause a synchronous change in the open state which
           * failes the next check for openAtStart.
           */
          store().setOpen(
            true,
            createChangeEventDetails(
              REASONS.listNavigation,
              event,
              event.currentTarget as HTMLElement,
            ),
          );
        } else {
          commonOnKeyDown(event);
        }

        if (currentOpen) {
          onNavigate(event);
        }
      }

      return undefined;
    },
    onMouseDown: checkVirtualMouse,
    onPointerDown: checkVirtualPointer,
    onPointerEnter: checkVirtualPointer,
  };

  const reference = solidMergeProps(ariaActiveDescendantProp, trigger) as ElementProps['reference'];

  return {
    get floating() {
      return props.enabled ? floating : undefined;
    },
    item,
    get reference() {
      return props.enabled ? reference : undefined;
    },
    get trigger() {
      return props.enabled ? trigger : undefined;
    },
  };
}
