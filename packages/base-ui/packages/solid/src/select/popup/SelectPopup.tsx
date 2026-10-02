import { createEffect, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { rectToClientRect } from '@floating-ui/utils';
import { COMPOSITE_KEYS } from '../../internals/composite/composite';
import { useCSPContext } from '../../csp-provider/CSPContext';
import { useDirection } from '../../direction-provider/DirectionContext';
import { FloatingFocusManager, platform as floatingPlatform } from '../../floating-ui-solid';
import type { ClientRectObject } from '../../floating-ui-solid/types';
import { splitComponentProps } from '../../solid-helpers';
import { useToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { addEventListener } from '../../utils/addEventListener';
import { clamp } from '../../utils/clamp';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { isWebKit } from '../../utils/detectBrowser';
import { getDisabledMountTransitionStyles } from '../../utils/getDisabledMountTransitionStyles';
import type { StateAttributesMapping } from '../../utils/getStateAttributesProps';
import { ownerDocument, ownerWindow } from '../../utils/owner';
import { popupStateMapping } from '../../utils/popupStateMapping';
import { REASONS } from '../../utils/reasons';
import { getMaxScrollOffset, SCROLL_EDGE_TOLERANCE_PX } from '../../utils/scrollEdges';
import { transitionStatusMapping } from '../../utils/stateAttributesMapping';
import { styleDisableScrollbar, useStyleDisableScrollbar } from '../../utils/styles';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import type { Align, Side } from '../../utils/useAnchorPositioning';
import { useAnimationFrame } from '../../utils/useAnimationFrame';
import type { InteractionType } from '../../utils/useEnhancedClickHandler';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import { useRenderElement } from '../../utils/useRenderElement';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { useSelectPositionerContext } from '../positioner/SelectPositionerContext';
import { SelectPositionerCssVars } from '../positioner/SelectPositionerCssVars';
import { useSelectFloatingContext, useSelectRootContext } from '../root/SelectRootContext';
import { clearStyles, LIST_FUNCTIONAL_STYLES } from './utils';

const stateAttributesMapping: StateAttributesMapping<SelectPopup.State> = {
  ...popupStateMapping,
  ...transitionStatusMapping,
};

/**
 * A container for the select list.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectPopup(componentProps: SelectPopup.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['finalFocus']);

  const rootContext = useSelectRootContext();
  const {
    store,
    popupRef,
    multiple,
    readOnly,
    highlightItemOnHover,
    keyboardActiveRef,
    scrollHandlerRef,
    listRef,
  } = rootContext;
  const floatingRootContext = useSelectFloatingContext();
  const {
    side,
    align,
    alignItemWithTriggerActive,
    isPositioned,
    setControlledAlignItemWithTrigger,
  } = useSelectPositionerContext();
  const insideToolbar = useToolbarRootContext(true) != null;
  const direction = useDirection();

  const csp = useCSPContext();

  const id = store.useState('id');
  const open = store.useState('open');
  const openMethod = store.useState('openMethod');
  const mounted = store.useState('mounted');
  const popupProps = store.useState('popupProps');
  const transitionStatus = store.useState('transitionStatus');
  const triggerElement = store.useState('triggerElement');
  const positionerElement = store.useState('positionerElement');
  const listElement = store.useState('listElement');
  let reachedMaxHeightRef = false;
  let initialPlacedRef = false;
  let originalPositionerStylesRef: JSX.CSSProperties = {};

  const scrollArrowFrame = useAnimationFrame();

  const handleScroll = (scroller: HTMLDivElement) => {
    const positionerEl = untrack(positionerElement);
    if (!positionerEl || !popupRef.current || !initialPlacedRef) {
      return;
    }

    const isTopPositioned = positionerEl.style.top === '0px';
    const isBottomPositioned = positionerEl.style.bottom === '0px';

    if (
      reachedMaxHeightRef ||
      !untrack(alignItemWithTriggerActive) ||
      (!isTopPositioned && !isBottomPositioned)
    ) {
      rootContext.handleScrollArrowVisibility(scroller);
      return;
    }

    const scale = getScale(positionerEl);
    const currentHeight = normalizeSize(positionerEl.getBoundingClientRect().height, 'y', scale);
    const doc = ownerDocument(positionerEl);
    const win = ownerWindow(positionerEl);
    const positionerStyles = win.getComputedStyle(positionerEl);
    const marginTop = parseFloat(positionerStyles.marginTop);
    const marginBottom = parseFloat(positionerStyles.marginBottom);
    const maxPopupHeight = getMaxPopupHeight(win.getComputedStyle(popupRef.current));
    const maxAvailableHeight = Math.min(
      doc.documentElement.clientHeight - marginTop - marginBottom,
      maxPopupHeight,
    );

    const scrollTop = scroller.scrollTop;
    const maxScrollTop = getMaxScrollTop(scroller);

    // `Infinity` requests a scroll to the recomputed maximum offset.
    let nextScrollTop: number | null = null;

    const setHeight = (height: number) => {
      positionerEl.style.height = `${height}px`;
    };

    const diff = isTopPositioned ? maxScrollTop - scrollTop : scrollTop;
    const nextHeight = Math.min(currentHeight + diff, maxAvailableHeight);

    if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
      const heightDelta = clamp(diff, 0, maxAvailableHeight - currentHeight);
      if (heightDelta > 0) {
        // Consume the remaining scroll in height.
        setHeight(currentHeight + heightDelta);
      }
      scroller.scrollTop = isTopPositioned ? maxScrollTop : 0;
      if (maxAvailableHeight - (currentHeight + heightDelta) <= SCROLL_EDGE_TOLERANCE_PX) {
        reachedMaxHeightRef = true;
      }
      rootContext.handleScrollArrowVisibility(scroller);
      return;
    }

    if (maxAvailableHeight - nextHeight > SCROLL_EDGE_TOLERANCE_PX) {
      nextScrollTop = isTopPositioned ? Infinity : 0;
    } else if (isBottomPositioned && scrollTop < maxScrollTop) {
      const overshoot = currentHeight + diff - maxAvailableHeight;
      nextScrollTop = scrollTop - (diff - overshoot);
    }

    const nextPositionerHeight = Math.ceil(nextHeight);

    if (nextPositionerHeight !== 0) {
      setHeight(nextPositionerHeight);
    }

    if (nextScrollTop != null) {
      // Recompute bounds after resizing (clientHeight likely changed).
      const target = clamp(nextScrollTop, 0, getMaxScrollTop(scroller));

      // Avoid adjustments that re-trigger scroll events forever.
      if (Math.abs(scroller.scrollTop - target) > SCROLL_EDGE_TOLERANCE_PX) {
        scroller.scrollTop = target;
      }
    }

    if (nextPositionerHeight >= maxAvailableHeight - SCROLL_EDGE_TOLERANCE_PX) {
      reachedMaxHeightRef = true;
    }

    rootContext.handleScrollArrowVisibility(scroller);
  };

  // Solid: `handleScroll` is a stable function, so the imperative handle is assigned once.
  scrollHandlerRef.current = handleScroll;

  useOpenChangeComplete({
    open,
    ref: () => popupRef.current,
    onComplete() {
      if (untrack(open)) {
        rootContext.onOpenChangeComplete?.(true);
      }
    },
  });

  const state: SelectPopup.State = {
    get open() {
      return open();
    },
    get transitionStatus() {
      return transitionStatus();
    },
    get side() {
      return side();
    },
    get align() {
      return align();
    },
  };

  createEffect(positionerElement, (positionerEl) => {
    if (!positionerEl || !popupRef.current || Object.keys(originalPositionerStylesRef).length) {
      return;
    }

    originalPositionerStylesRef = {
      top: positionerEl.style.top || '0',
      left: positionerEl.style.left || '0',
      right: positionerEl.style.right,
      height: positionerEl.style.height,
      bottom: positionerEl.style.bottom,
      'min-height': positionerEl.style.minHeight,
      'max-height': positionerEl.style.maxHeight,
      'margin-top': positionerEl.style.marginTop,
      'margin-bottom': positionerEl.style.marginBottom,
    };
  });

  createEffect(
    () => ({
      open: open(),
      alignItemWithTriggerActive: alignItemWithTriggerActive(),
      positionerElement: positionerElement(),
    }),
    (deps) => {
      if (deps.open || deps.alignItemWithTriggerActive) {
        return;
      }

      initialPlacedRef = false;
      reachedMaxHeightRef = false;
      clearStyles(deps.positionerElement, originalPositionerStylesRef);
    },
  );

  createEffect(
    () => ({
      open: open(),
      positionerElement: positionerElement(),
      triggerElement: triggerElement(),
      alignItemWithTriggerActive: alignItemWithTriggerActive(),
      listElement: listElement(),
      highlightItemOnHover: highlightItemOnHover(),
      direction: direction(),
      isPositioned: isPositioned(),
    }),
    (deps) => {
      const popupElement = popupRef.current;
      const positionerEl = deps.positionerElement;
      const triggerEl = deps.triggerElement;
      const listEl = deps.listElement;

      // Wait for Floating UI's first positioning pass before reading DOM geometry.
      // We replace the final coordinates for aligned selects, but still need middleware
      // like `size()` to set CSS variables such as `--anchor-width`.
      if (
        !deps.open ||
        !triggerEl ||
        !positionerEl ||
        !popupElement ||
        (deps.alignItemWithTriggerActive && !deps.isPositioned) ||
        store.state.transitionStatus === 'ending'
      ) {
        return;
      }

      initialPlacedRef = true;
      popupElement.style.removeProperty(SelectPositionerCssVars.transformOrigin);

      if (!deps.alignItemWithTriggerActive) {
        // The wrapper supplies the scroller: the list owns scrolling once it has mounted, and
        // this effect re-runs (cancelling the stale frame) when that happens.
        scrollArrowFrame.request(() =>
          rootContext.handleScrollArrowVisibility(listEl || popupElement),
        );
        return;
      }

      // Ensure we remove any transforms that can affect the location of the popup
      // and therefore the calculations.
      const restoreTransformStyles = unsetTransformStyles(popupElement);

      try {
        let textElement = rootContext.selectedItemTextRef.current;

        if (!textElement?.isConnected) {
          const hasSelectedValue = store.select('hasSelectedValue');
          textElement =
            !hasSelectedValue && rootContext.firstItemTextRef.current?.isConnected
              ? rootContext.firstItemTextRef.current
              : null;
        }

        const valueElement = rootContext.valueRef.current;

        const win = ownerWindow(positionerEl);
        const positionerStyles = win.getComputedStyle(positionerEl);
        const popupStyles = win.getComputedStyle(popupElement);

        const doc = ownerDocument(triggerEl);
        const scale = getScale(triggerEl);
        const triggerRect = normalizeRect(triggerEl.getBoundingClientRect(), scale);

        const positionerRect = normalizeRect(positionerEl.getBoundingClientRect(), scale);
        const triggerHeight = triggerRect.height;
        const scroller = listEl || popupElement;
        const scrollHeight = scroller.scrollHeight;

        const borderBottom = parseFloat(popupStyles.borderBottomWidth);
        // The `|| N` fallbacks cover an unset/`auto` value (parses to `NaN`). Note a literal `0`
        // also resolves to the fallback, so an explicit `margin: 0` or `min-height: 0` still takes
        // the default below.
        const marginTop = parseFloat(positionerStyles.marginTop) || 10;
        const marginBottom = parseFloat(positionerStyles.marginBottom) || 10;
        const minHeight = parseFloat(positionerStyles.minHeight) || 100;
        const maxPopupHeight = getMaxPopupHeight(popupStyles);

        const paddingLeft = 5;
        const paddingRight = 5;
        const triggerCollisionThreshold = 20;

        const viewportHeight = doc.documentElement.clientHeight - marginTop - marginBottom;
        const viewportWidth = doc.documentElement.clientWidth;
        const availableSpaceBeneathTrigger = viewportHeight - triggerRect.bottom + triggerHeight;

        let textRect: ClientRectObject | undefined;
        let alignedLeft =
          deps.direction === 'rtl' ? triggerRect.right - positionerRect.width : triggerRect.left;
        let offsetY = 0;

        if (textElement && valueElement) {
          const valueRect = normalizeRect(valueElement.getBoundingClientRect(), scale);
          textRect = normalizeRect(textElement.getBoundingClientRect(), scale);

          alignedLeft =
            positionerRect.left +
            (deps.direction === 'rtl'
              ? valueRect.right - textRect.right
              : valueRect.left - textRect.left);
          const valueCenterFromTriggerTop = valueRect.top - triggerRect.top + valueRect.height / 2;
          const textCenterFromPositionerTop =
            textRect.top - positionerRect.top + textRect.height / 2;

          offsetY = textCenterFromPositionerTop - valueCenterFromTriggerTop;
        }

        const idealHeight = availableSpaceBeneathTrigger + offsetY + marginBottom + borderBottom;
        let height = Math.min(viewportHeight, idealHeight);
        const maxHeight = viewportHeight - marginTop - marginBottom;
        const scrollTop = idealHeight - height;

        const maxRight = viewportWidth - paddingRight;

        positionerEl.style.left = `${clamp(
          alignedLeft,
          paddingLeft,
          maxRight - positionerRect.width,
        )}px`;
        positionerEl.style.height = `${height}px`;
        // `none` (not the invalid `auto`) so the explicit height governs in align mode and isn't
        // clamped by a `max-height` from user CSS.
        positionerEl.style.maxHeight = 'none';
        positionerEl.style.marginTop = `${marginTop}px`;
        positionerEl.style.marginBottom = `${marginBottom}px`;
        popupElement.style.height = '100%';

        const maxScrollTop = getMaxScrollTop(scroller);
        const isTopPositioned = scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;

        if (isTopPositioned) {
          height = Math.min(viewportHeight, positionerRect.height) - (scrollTop - maxScrollTop);
        }

        // When the trigger is too close to the top or bottom of the viewport, or the minHeight is
        // reached, we fallback to aligning the popup to the trigger as the UX is poor otherwise.
        const fallbackToAlignPopupToTrigger =
          triggerRect.top < triggerCollisionThreshold ||
          triggerRect.bottom > viewportHeight - triggerCollisionThreshold ||
          Math.ceil(height) + SCROLL_EDGE_TOLERANCE_PX < Math.min(scrollHeight, minHeight);

        // Safari doesn't position the popup correctly when pinch-zoomed.
        const isPinchZoomed = (win.visualViewport?.scale ?? 1) !== 1 && isWebKit;

        if (fallbackToAlignPopupToTrigger || isPinchZoomed) {
          clearStyles(positionerEl, originalPositionerStylesRef);
          setControlledAlignItemWithTrigger(false);
          return;
        }

        const initialHeight = Math.max(minHeight, height);

        if (isTopPositioned) {
          const topOffset = Math.max(0, viewportHeight - idealHeight);
          positionerEl.style.top = positionerRect.height >= maxHeight ? '0' : `${topOffset}px`;
          positionerEl.style.height = `${height}px`;
          scroller.scrollTop = getMaxScrollTop(scroller);
        } else {
          positionerEl.style.bottom = '0';
          scroller.scrollTop = scrollTop;
        }

        if (textRect) {
          const popupTop = positionerRect.top;
          const popupHeight = positionerRect.height;
          const textCenterY = textRect.top + textRect.height / 2;

          const clampedY = clamp(
            popupHeight > 0 ? ((textCenterY - popupTop) / popupHeight) * 100 : 50,
            0,
            100,
          );

          popupElement.style.setProperty(
            SelectPositionerCssVars.transformOrigin,
            `50% ${clampedY}%`,
          );
        }

        if (initialHeight === viewportHeight || height >= maxPopupHeight) {
          reachedMaxHeightRef = true;
        }

        rootContext.handleScrollArrowVisibility(scroller);

        if (
          deps.highlightItemOnHover &&
          store.state.selectedIndex === null &&
          store.state.activeIndex === null &&
          listRef.current[0] != null
        ) {
          store.set('activeIndex', 0);
        }
      } finally {
        restoreTransformStyles();
      }
    },
  );

  createEffect(
    () => ({
      alignItemWithTriggerActive: alignItemWithTriggerActive(),
      positionerElement: positionerElement(),
      open: open(),
    }),
    (deps) => {
      if (!deps.alignItemWithTriggerActive || !deps.positionerElement || !deps.open) {
        return undefined;
      }

      const win = ownerWindow(deps.positionerElement);

      function handleResize(event: UIEvent) {
        rootContext.setOpen(false, createChangeEventDetails(REASONS.windowResize, event));
      }

      return addEventListener(win, 'resize', handleResize);
    },
  );

  // Solid: the trigger reads the listbox id from the store (React reads it from the DOM).
  createEffect(
    () => (listElement() ? undefined : (elementProps.id ?? `${id()}-list`)),
    (listboxId) => {
      if (listboxId !== undefined) {
        store.set('listboxId', listboxId);
      }
    },
  );

  const defaultProps: HTMLProps = {
    get role() {
      return listElement() ? 'presentation' : 'listbox';
    },
    get ['aria-multiselectable' as string]() {
      return !listElement() && multiple() ? 'true' : undefined;
    },
    get ['aria-readonly' as string]() {
      return !listElement() && readOnly() ? 'true' : undefined;
    },
    get id() {
      return listElement() ? undefined : `${id()}-list`;
    },
    onKeyDown(event) {
      // Solid: SelectItem's hover highlighting reads the last input modality.
      keyboardActiveRef.current = true;
      if (insideToolbar && COMPOSITE_KEYS.has(event.key)) {
        event.stopPropagation();
      }
    },
    onMouseMove() {
      // Solid: SelectItem's hover highlighting reads the last input modality.
      keyboardActiveRef.current = false;
    },
    onScroll(event) {
      if (listElement()) {
        return;
      }
      handleScroll(event.currentTarget);
    },
    get style() {
      if (alignItemWithTriggerActive()) {
        return listElement() ? { height: '100%' } : LIST_FUNCTIONAL_STYLES;
      }
      // Solid: an empty object removes only the keys applied before; `undefined` would drop
      // the whole `style` attribute, including inline styles set by user refs.
      return {};
    },
    get class() {
      return !listElement() && alignItemWithTriggerActive()
        ? styleDisableScrollbar.class
        : undefined;
    },
  };

  const element = useRenderElement('div', componentProps, {
    ref: (el) => {
      popupRef.current = el;
    },
    state,
    stateAttributesMapping,
    get props() {
      return [
        popupProps(),
        defaultProps,
        getDisabledMountTransitionStyles(transitionStatus()),
        elementProps,
      ];
    },
  });

  useStyleDisableScrollbar(csp);

  return (
    <FloatingFocusManager
      context={floatingRootContext}
      modal={false}
      disabled={!mounted()}
      openInteractionType={openMethod()}
      returnFocus={local.finalFocus}
      restoreFocus
    >
      {element()}
    </FloatingFocusManager>
  );
}

export interface SelectPopupProps extends BaseUIComponentProps<'div', SelectPopup.State> {
  children?: JSX.Element;
  /**
   * Determines the element to focus when the select popup is closed.
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

export interface SelectPopupState {
  side: Side | 'none';
  align: Align;
  open: boolean;
  transitionStatus: TransitionStatus;
}

export namespace SelectPopup {
  export type Props = SelectPopupProps;
  export type State = SelectPopupState;
}

function getMaxPopupHeight(popupStyles: CSSStyleDeclaration) {
  const maxHeightStyle = popupStyles.maxHeight;
  return maxHeightStyle.endsWith('px') ? parseFloat(maxHeightStyle) || Infinity : Infinity;
}

function getMaxScrollTop(scroller: HTMLElement) {
  return getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
}

function getScale(element: HTMLElement) {
  // The platform API is async-capable, but the DOM platform returns a plain scale object.
  return floatingPlatform.getScale(element) as { x: number; y: number };
}

function normalizeSize(size: number, axis: 'x' | 'y', scale: { x: number; y: number }) {
  return size / scale[axis];
}

function normalizeRect(
  rect: DOMRect | DOMRectReadOnly,
  scale: { x: number; y: number },
): ClientRectObject {
  return rectToClientRect({
    x: normalizeSize(rect.x, 'x', scale),
    y: normalizeSize(rect.y, 'y', scale),
    width: normalizeSize(rect.width, 'x', scale),
    height: normalizeSize(rect.height, 'y', scale),
  });
}

const TRANSFORM_STYLE_RESETS = [
  ['transform', 'none'],
  ['scale', '1'],
  ['translate', '0 0'],
] as const;

type TransformStyleProperty = (typeof TRANSFORM_STYLE_RESETS)[number][0];

function unsetTransformStyles(popupElement: HTMLElement) {
  const { style } = popupElement;
  const originalStyles = {} as Record<TransformStyleProperty, string>;

  for (const [property, value] of TRANSFORM_STYLE_RESETS) {
    originalStyles[property] = style.getPropertyValue(property);
    style.setProperty(property, value, 'important');
  }

  return () => {
    for (const [property] of TRANSFORM_STYLE_RESETS) {
      const originalValue = originalStyles[property];
      if (originalValue) {
        style.setProperty(property, originalValue);
      } else {
        style.removeProperty(property);
      }
    }
  };
}
