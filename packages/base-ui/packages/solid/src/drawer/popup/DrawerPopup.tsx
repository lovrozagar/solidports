import { createMemo, createSignal, onSettled, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { error } from '../../utils/error';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';
import { createDepsEffect, createDepsRenderEffect, splitComponentProps } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import { FloatingFocusManager } from '../../floating-ui-solid';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { useRenderElement } from '../../utils/useRenderElement';
import type { BaseUIComponentProps } from '../../utils/types';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { DrawerBackdropCssVars } from '../backdrop/DrawerBackdropCssVars';
import { DrawerPopupCssVars } from './DrawerPopupCssVars';
import { DrawerPopupDataAttributes } from './DrawerPopupDataAttributes';
import { useDialogPortalContext } from '../../dialog/portal/DialogPortalContext';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { getSnapPointSwipeMovement, useDrawerSnapPoints } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';
import { FOCUSABLE_POPUP_PROPS } from '../../utils/popups';

// Module-level flag to ensure we only register the CSS properties once,
// regardless of how many Drawer components are mounted.
let drawerSwipeVarsRegistered = false;

/**
 * Removes inheritance of high-frequency drawer swipe CSS variables, which
 * reduces style recalculation cost in complex drawers with deep subtrees.
 * See https://motion.dev/blog/web-animation-performance-tier-list
 * under the "Improving CSS variable performance" section.
 */
function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  // Intentionally keep inheritance disabled on WebKit as well. Safari doesn't support
  // opting descendants back in via `--var: inherit` for custom properties registered
  // with `inherits: false`, but Drawer does not rely on descendant access to these vars
  // (unlike ScrollArea), so we keep the performance optimization enabled.
  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<length>',
          inherits: false,
          initialValue: '0px',
        });
      } catch {
        /* ignore already-registered */
      }
    });

    [
      {
        name: DrawerBackdropCssVars.swipeProgress,
        initialValue: '0',
      },
      {
        name: DrawerPopupCssVars.swipeStrength,
        initialValue: '1',
      },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({
          name,
          syntax: '<number>',
          inherits: false,
          initialValue,
        });
      } catch {
        /* ignore already-registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopupState> = {
  // React's `popupTransitionStateMapping`.
  ...popupStateMapping,
  ...transitionStatusMapping,
  expanded(value) {
    return value ? { [DrawerPopupDataAttributes.expanded]: '' } : null;
  },
  nestedDrawerOpen(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerOpen]: '' } : null;
  },
  nestedDrawerSwiping(value) {
    return value ? { [DrawerPopupDataAttributes.nestedDrawerSwiping]: '' } : null;
  },
  swipeDirection(value) {
    return { [DrawerPopupDataAttributes.swipeDirection]: value };
  },
  swiping(value) {
    return value ? { [DrawerPopupDataAttributes.swiping]: '' } : null;
  },
};

/**
 * A container for the drawer contents.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Drawer](https://base-ui.com/react/components/drawer)
 */
export function DrawerPopup(componentProps: DrawerPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, [
    'finalFocus',
    'initialFocus',
  ]);

  const store = useDialogRootContext();
  const popupRef = store.context.popupRef;

  const {
    swipeDirection,
    frontmostHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgressStore,
    onPopupHeightChange,
    notifyParentFrontmostHeight,
    notifyParentHasNestedDrawer,
  } = useDrawerRootContext();

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
  const floatingRootContext = store.context.floatingRootContext;
  const rootPopupProps = store.useState('popupProps');
  const modal = store.useState('modal');
  const mounted = store.useState('mounted');
  const nested = store.useState('nested');
  const nestedOpenDrawerCount = store.useState('nestedOpenDrawerCount');
  const transitionStatus = store.useState('transitionStatus');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const titleElementId = store.useState('titleElementId');
  const role = store.useState('role');
  const floatingId = floatingRootContext.useState('floatingId');

  const popupId = () => elementProps.id ?? floatingId();

  const swipe = useDrawerViewportContext();
  useDialogPortalContext();
  const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints();

  const nestedDrawerOpen = () => nestedOpenDrawerCount() > 0;
  const swiping = () => swipe?.swiping() ?? false;
  const swipeStrength = () => swipe?.swipeStrength() ?? null;

  const popupElementState = store.useState('popupElement');

  // Solid: written by the layout-timed measurement below, whose first run is in the component body.
  const [popupHeight, setPopupHeight] = createSignal(0, { ownedWrite: true });
  let popupHeightRef = 0;

  /* istanbul ignore else -- process.env.NODE_ENV is a build-time constant. */
  if (process.env.NODE_ENV !== 'production') {
    // Solid: the viewport context never changes, so React's `[swipe]` effect runs once.
    onSettled(() => {
      if (swipe) {
        return;
      }

      const message =
        '<Drawer.Popup> expected to be rendered within <Drawer.Viewport>. Omitting the ' +
        'viewport disables drawer swipe handling and touch scroll locking. Wrap ' +
        '<Drawer.Popup> in <Drawer.Viewport>.';
      error(message);
    });
  }

  // Stable callback: reads the latest context values untracked.
  const measureHeight = () => {
    const popupElement = popupRef.current;
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (
      popupHeightRef > 0 &&
      untrack(frontmostHeight) > popupHeightRef &&
      offsetHeight > popupHeightRef
    ) {
      return;
    }

    const keepHeightWhileNested = popupHeightRef > 0 && untrack(hasNestedDrawer);
    if (keepHeightWhileNested) {
      const oldHeight = popupHeightRef;
      setPopupHeight(oldHeight);
      onPopupHeightChange(oldHeight);
      return;
    }

    const nextHeight = offsetHeight;
    if (nextHeight === popupHeightRef) {
      return;
    }

    popupHeightRef = nextHeight;
    setPopupHeight(nextHeight);
    onPopupHeightChange(nextHeight);
  };

  // Solid: measure after the flush's DOM updates, as React's layout effect runs after commit. A
  // render effect can run before an ancestor drops `hidden` (keepMounted), measuring `0`.
  createDepsEffect(
    () => ({
      mounted: mounted(),
      nestedDrawerOpen: nestedDrawerOpen(),
      // Solid: the popup element attaches after this effect first runs (React attaches refs
      // before layout effects), so rerun once it exists.
      popupElement: popupElementState(),
    }),
    (deps) => {
      if (!deps.mounted) {
        popupHeightRef = 0;
        setPopupHeight(0);
        onPopupHeightChange(0);
        return undefined;
      }

      const popupElement = popupRef.current;
      if (!popupElement) {
        return undefined;
      }

      removeCSSVariableInheritance();
      measureHeight();

      if (typeof ResizeObserver !== 'function') {
        return undefined;
      }

      const resizeObserver = new ResizeObserver(measureHeight);

      resizeObserver.observe(popupElement);
      return () => {
        resizeObserver.disconnect();
      };
    },
  );

  // The store and popup ref are fixed, so this subscribes once mounted.
  onSettled(() => {
    const syncNestedSwipeProgress = () => {
      const popupElement = popupRef.current;
      if (!popupElement) {
        return;
      }

      const progress = nestedSwipeProgressStore.getSnapshot();
      if (progress > 0) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, `${progress}`);
      } else {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    };

    syncNestedSwipeProgress();
    const unsubscribe = nestedSwipeProgressStore.subscribe(syncNestedSwipeProgress);
    const popupElement = popupRef.current;

    return () => {
      unsubscribe();
      if (popupElement) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    };
  });

  createDepsRenderEffect(
    () => ({ frontmostHeight: frontmostHeight(), open: open() }),
    (deps) => {
      if (!deps.open) {
        return undefined;
      }

      notifyParentFrontmostHeight?.(deps.frontmostHeight);

      return () => {
        notifyParentFrontmostHeight?.(0);
      };
    },
  );

  createDepsRenderEffect(
    () => ({ open: open(), transitionStatus: transitionStatus() }),
    (deps) => {
      if (!notifyParentHasNestedDrawer) {
        return undefined;
      }

      const present = deps.open || deps.transitionStatus === 'ending';
      notifyParentHasNestedDrawer(present);

      return () => {
        notifyParentHasNestedDrawer(false);
      };
    },
  );

  useOpenChangeComplete({
    open,
    get ref() {
      return popupRef.current;
    },
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
  });

  const resolvedInitialFocus = () =>
    local.initialFocus === undefined ? popupRef : local.initialFocus;

  const setPopupElement = store.useStateSetter('popupElement');

  const state: DrawerPopupState = {
    get open() {
      return open();
    },
    get nested() {
      return nested();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get expanded() {
      return activeSnapPoint?.() === 1;
    },
    get nestedDrawerOpen() {
      return nestedDrawerOpen();
    },
    get nestedDrawerSwiping() {
      return nestedSwiping();
    },
    get swipeDirection() {
      return swipeDirection();
    },
    get swiping() {
      return swiping();
    },
  };

  const popupHeightCssVarValue = createMemo(() => {
    const shouldUseAutoHeight = !hasNestedDrawer() && transitionStatus() !== 'ending';
    if (popupHeight() && !shouldUseAutoHeight) {
      return `${popupHeight()}px`;
    }
    return undefined;
  });

  const shouldApplySnapPoints = createMemo(() => {
    const points = snapPoints?.();
    return Boolean(
      points && points.length > 0 && (swipeDirection() === 'down' || swipeDirection() === 'up'),
    );
  });

  const snapPointOffsetValue = createMemo(() => {
    const offset = activeSnapPointOffset();
    if (shouldApplySnapPoints() && offset !== null) {
      return swipeDirection() === 'up' ? -offset : offset;
    }
    return null;
  });

  const dragStyles = (): JSX.CSSProperties => {
    let styles: JSX.CSSProperties = swipe ? swipe.getDragStyles() : EMPTY_OBJECT;
    if (shouldApplySnapPoints() && swipeDirection() === 'down') {
      const baseOffset = activeSnapPointOffset() ?? 0;
      const movementValue = Number.parseFloat(
        String((styles as Record<string, string>)[DrawerPopupCssVars.swipeMovementY]),
      );

      if (swiping() && Number.isFinite(movementValue)) {
        styles = {
          ...styles,
          transform: undefined,
          [DrawerPopupCssVars.swipeMovementY]: `${getSnapPointSwipeMovement(
            baseOffset,
            movementValue,
          )}px`,
        };
      } else {
        styles = {
          ...styles,
          transform: undefined,
        };
      }
    }
    return styles;
  };

  const element = useRenderElement('div', componentProps, {
    state,
    get props() {
      const swipeStrengthValue = swipeStrength();
      const snapPointOffset = snapPointOffsetValue();
      return [
        rootPopupProps(),
        {
          id: popupId(),
          'aria-labelledby': titleElementId(),
          'aria-describedby': descriptionElementId(),
          role: role(),
          ...FOCUSABLE_POPUP_PROPS,
          hidden: !mounted(),
          onKeyDown(event: KeyboardEvent) {
            if (COMPOSITE_KEYS.has(event.key)) {
              event.stopPropagation();
            }
          },
          style: {
            ...dragStyles(),
            [DrawerBackdropCssVars.swipeProgress]: '0',
            [DrawerPopupCssVars.nestedDrawers]: nestedOpenDrawerCount(),
            [DrawerPopupCssVars.height]: popupHeightCssVarValue(),
            [DrawerPopupCssVars.snapPointOffset]:
              typeof snapPointOffset === 'number' ? `${snapPointOffset}px` : '0px',
            [DrawerPopupCssVars.frontmostHeight]: frontmostHeight()
              ? `${frontmostHeight()}px`
              : undefined,
            [DrawerPopupCssVars.swipeStrength]:
              typeof swipeStrengthValue === 'number' &&
              Number.isFinite(swipeStrengthValue) &&
              swipeStrengthValue > 0
                ? `${swipeStrengthValue}`
                : '1',
          } as JSX.CSSProperties,
        },
        elementProps,
      ];
    },
    ref: [popupRef, setPopupElement],
    stateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      openInteractionType={openMethod()}
      disabled={!mounted()}
      closeOnFocusOut={!disablePointerDismissal()}
      initialFocus={resolvedInitialFocus()}
      returnFocus={local.finalFocus}
      modal={modal() !== false}
      restoreFocus="popup"
    >
      {element()}
    </FloatingFocusManager>
  );
}

export interface DrawerPopupProps extends BaseUIComponentProps<'div', DrawerPopup.State> {
  /**
   * Determines the element to focus when the drawer is opened.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (first tabbable element or popup).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  initialFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((openType: InteractionType) => boolean | HTMLElement | null | undefined | void)
      )
    | undefined;
  /**
   * Determines the element to focus when the drawer is closed.
   *
   * - `false`: Do not move focus.
   * - `true`: Move focus based on the default behavior (trigger or previously focused element).
   * - `RefObject`: Move focus to the ref element.
   * - `function`: Called with the interaction type (`mouse`, `touch`, `pen`, or `keyboard`).
   *   Return an element to focus, `true` to use the default behavior, or `false`/`undefined` to do nothing.
   */
  finalFocus?:
    | (
        | boolean
        | HTMLElement
        | null
        | ((closeType: InteractionType) => boolean | HTMLElement | null | undefined | void)
      )
    | undefined;
}

export interface DrawerPopupState {
  /**
   * Whether the drawer is currently open.
   */
  open: boolean;
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
  /**
   * Whether the active snap point is the full-height expanded state.
   */
  expanded: boolean;
  /**
   * Whether the drawer is nested within a parent drawer.
   */
  nested: boolean;
  /**
   * Whether the drawer has nested drawers open.
   */
  nestedDrawerOpen: boolean;
  /**
   * Whether a nested drawer is currently being swiped.
   */
  nestedDrawerSwiping: boolean;
  /**
   * The swipe direction used to dismiss the drawer.
   */
  swipeDirection: DrawerSwipeDirection;
  /**
   * Whether the drawer is being swiped.
   */
  swiping: boolean;
}

export namespace DrawerPopup {
  export type Props = DrawerPopupProps;
  export type State = DrawerPopupState;
}
