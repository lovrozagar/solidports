import { createTrackedEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import { FloatingFocusManager } from '../../floating-ui-solid';
import { splitComponentProps } from '../../solid-helpers';
import { EMPTY_OBJECT } from '../../utils/constants';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { popupStateMapping as baseMapping } from '../../utils/popupStateMapping';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import type { BaseUIComponentProps } from '../../utils/types';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { DrawerBackdropCssVars } from '../backdrop/DrawerBackdropCssVars';
import { useDrawerRootContext, type DrawerSwipeDirection } from '../root/DrawerRootContext';
import { useDrawerSnapPoints } from '../root/useDrawerSnapPoints';
import { useDrawerViewportContext } from '../viewport/DrawerViewportContext';
import { DrawerPopupCssVars } from './DrawerPopupCssVars';
import { DrawerPopupDataAttributes } from './DrawerPopupDataAttributes';

/* Registered once per document load to avoid costly style recalculation in deep subtrees. */
let drawerSwipeVarsRegistered = false;

function removeCSSVariableInheritance() {
  if (drawerSwipeVarsRegistered) {
    return;
  }

  if (typeof CSS !== 'undefined' && 'registerProperty' in CSS) {
    [
      DrawerPopupCssVars.swipeMovementX,
      DrawerPopupCssVars.swipeMovementY,
      DrawerPopupCssVars.snapPointOffset,
    ].forEach((name) => {
      try {
        CSS.registerProperty({ inherits: false, initialValue: '0px', name, syntax: '<length>' });
      } catch {
        /* already registered */
      }
    });

    [
      { initialValue: '0', name: DrawerBackdropCssVars.swipeProgress },
      { initialValue: '1', name: DrawerPopupCssVars.swipeStrength },
    ].forEach(({ name, initialValue }) => {
      try {
        CSS.registerProperty({ inherits: false, initialValue, name, syntax: '<number>' });
      } catch {
        /* already registered */
      }
    });
  }

  drawerSwipeVarsRegistered = true;
}

const stateAttributesMapping: StateAttributesMapping<DrawerPopup.State> = {
  ...baseMapping,
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
    return value ? { [DrawerPopupDataAttributes.swipeDirection]: value } : null;
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

  const { store } = useDialogRootContext();

  const {
    swipeDirection,
    frontmostHeight,
    hasNestedDrawer,
    nestedSwiping,
    nestedSwipeProgress,
    onPopupHeightChange,
    notifyParentFrontmostHeight,
    notifyParentHasNestedDrawer,
  } = useDrawerRootContext();

  const descriptionElementId = store.useState('descriptionElementId');
  const disablePointerDismissal = store.useState('disablePointerDismissal');
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

  const nestedDrawerOpen = () => nestedOpenDrawerCount() > 0;

  const swipe = useDrawerViewportContext(true);
  const swiping = () => swipe?.swiping() ?? false;
  const swipeStrength = () => swipe?.swipeStrength() ?? null;
  const { snapPoints, activeSnapPoint, activeSnapPointOffset } = useDrawerSnapPoints();

  const [popupHeight, setPopupHeight] = createSignal(0);

  let popupHeightRef = 0;

  const measureHeight = () => {
    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return;
    }

    const offsetHeight = popupElement.offsetHeight;

    // Only skip while the element is still actually stretched beyond its last measured height.
    if (popupHeightRef > 0 && frontmostHeight() > popupHeightRef && offsetHeight > popupHeightRef) {
      return;
    }

    const keepHeightWhileNested = popupHeightRef > 0 && hasNestedDrawer();
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

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!mounted()) {
      popupHeightRef = 0;
      setPopupHeight(0);
      onPopupHeightChange(0);
      return;
    }

    const popupElement = store.context.popupRef.current;
    if (!popupElement) {
      return;
    }

    removeCSSVariableInheritance();
    measureHeight();

    if (typeof ResizeObserver !== 'function') {
      return;
    }

    const resizeObserver = new ResizeObserver(measureHeight);

    resizeObserver.observe(popupElement);
    _c.push(() => {
      resizeObserver.disconnect();
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const popupRef = store.context.popupRef.current;

    const syncNestedSwipeProgress = () => {
      const popupElement = popupRef;
      if (!popupElement) {
        return;
      }

      if (nestedSwipeProgress() > 0) {
        popupElement.style.setProperty(
          DrawerBackdropCssVars.swipeProgress,
          `${nestedSwipeProgress()}`,
        );
      } else {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    };

    syncNestedSwipeProgress();

    _c.push(() => {
      const popupElement = popupRef;
      if (popupElement) {
        popupElement.style.setProperty(DrawerBackdropCssVars.swipeProgress, '0');
      }
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!open()) {
      return;
    }

    notifyParentFrontmostHeight?.(frontmostHeight());

    _c.push(() => {
      notifyParentFrontmostHeight?.(0);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!notifyParentHasNestedDrawer) {
      return;
    }

    const present = open() || transitionStatus() === 'ending';
    notifyParentHasNestedDrawer(present);

    _c.push(() => {
      notifyParentHasNestedDrawer(false);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  useOpenChangeComplete({
    onComplete() {
      if (open()) {
        store.context.onOpenChangeComplete?.(true);
      }
    },
    open,
    ref: store.context.popupRef.current,
  });

  const resolvedInitialFocus = () =>
    local.initialFocus === undefined ? store.context.popupRef.current : local.initialFocus;

  const state: DrawerPopup.State = {
    get expanded() {
      return activeSnapPoint?.() === 1;
    },
    get nested() {
      return nested();
    },
    get nestedDrawerOpen() {
      return nestedDrawerOpen();
    },
    get nestedDrawerSwiping() {
      return nestedSwiping();
    },
    get open() {
      return open();
    },
    get swipeDirection() {
      return swipeDirection();
    },
    get swiping() {
      return swiping();
    },
    get transitionStatus() {
      return transitionStatus();
    },
  };

  const popupHeightCssVarValue = createMemo(() => {
    const shouldUseAutoHeight = !hasNestedDrawer() && transitionStatus() !== 'ending';
    if (popupHeight && !shouldUseAutoHeight) {
      return `${popupHeight()}px`;
    }

    return undefined;
  });

  const shouldApplySnapPoints = createMemo(() => {
    const points = snapPoints?.();
    return (
      points && points.length > 0 && (swipeDirection() === 'down' || swipeDirection() === 'up')
    );
  });

  const snapPointOffsetValue = createMemo(() => {
    const offset = activeSnapPointOffset();
    if (shouldApplySnapPoints() && offset !== null) {
      return swipeDirection() === 'up' ? -offset : offset;
    }

    return null;
  });

  const dragStyles = createMemo<JSX.CSSProperties>(() => {
    const defaultStyles: JSX.CSSProperties = swipe ? swipe.getDragStyles() : EMPTY_OBJECT;

    if (shouldApplySnapPoints() && swipeDirection() === 'down') {
      const baseOffset = activeSnapPointOffset() ?? 0;
      const movementValue = Number.parseFloat(
        String((defaultStyles as Record<string, string>)[DrawerPopupCssVars.swipeMovementY] ?? 0),
      );
      const nextOffset = Number.isFinite(movementValue) ? baseOffset + movementValue : baseOffset;
      const shouldDamp = nextOffset < 0;

      if (swiping() && shouldDamp && Number.isFinite(movementValue)) {
        const overshoot = Math.abs(nextOffset);
        const dampedOffset = -Math.sqrt(overshoot);
        const dampedMovement = dampedOffset - baseOffset;
        return {
          ...defaultStyles,
          transform: undefined,
          [DrawerPopupCssVars.swipeMovementY]: `${dampedMovement}px`,
        };
      }

      return {
        ...defaultStyles,
        transform: undefined,
      };
    }

    return defaultStyles;
  });

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [
        rootPopupProps(),
        {
          get 'aria-labelledby'() {
            return titleElementId();
          },
          get 'aria-describedby'() {
            return descriptionElementId();
          },
          get role() {
            return role();
          },
          tabindex: -1,
          get hidden() {
            return !mounted();
          },
          onKeyDown(event: KeyboardEvent) {
            if (COMPOSITE_KEYS.has(event.key)) {
              event.stopPropagation();
            }
          },
          get style() {
            const swipeStrengthValue = swipeStrength();
            return {
              ...dragStyles(),
              [DrawerBackdropCssVars.swipeProgress]: '0',
              [DrawerPopupCssVars.nestedDrawers]: nestedOpenDrawerCount(),
              [DrawerPopupCssVars.height]: popupHeightCssVarValue(),
              [DrawerPopupCssVars.snapPointOffset]:
                typeof snapPointOffsetValue() === 'number' ? `${snapPointOffsetValue()}px` : '0px',
              [DrawerPopupCssVars.frontmostHeight]: frontmostHeight()
                ? `${frontmostHeight()}px`
                : undefined,
              [DrawerPopupCssVars.swipeStrength]:
                typeof swipeStrengthValue === 'number' &&
                Number.isFinite(swipeStrengthValue) &&
                swipeStrengthValue > 0
                  ? `${swipeStrengthValue}`
                  : '1',
            };
          },
        },
        elementProps,
      ];
    },
    ref: (el) => {
      store.context.popupRef.current = el;
      store.useStateSetter('popupElement')(el);
    },
    state,
    stateAttributesMapping,
  });

  return (
    <FloatingFocusManager
      context={store.context.floatingRootContext}
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
