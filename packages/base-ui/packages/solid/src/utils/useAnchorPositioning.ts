import { getAlignment, getSide, getSideAxis, type Rect } from '@floating-ui/utils';
import { createEffect, createMemo, createSignal, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useDirection } from '../direction-provider/DirectionContext';
import {
  autoUpdate,
  flip,
  limitShift,
  offset,
  shift as floatingShift,
  size,
  useFloating,
  type Accessorify,
  type AutoUpdateOptions,
  type FloatingContext,
  type FloatingRootContext,
  type FloatingTreeStore,
  type Middleware,
  type MiddlewareState,
  type Padding,
  type Side as PhysicalSide,
  type Placement,
  type UseFloatingOptions,
  type VirtualElement,
} from '../floating-ui-solid/index';
import { arrow } from '../floating-ui-solid/middleware/arrow';
import {
  createDepsEffect,
  createDepsRenderEffect,
  access,
  useRef,
  type MaybeAccessor,
  type MaybeAccessorValue,
  type ReactLikeRef,
  shallowEqual,
} from '../solid-helpers';
import { DEFAULT_SIDES } from './adaptiveOriginMiddleware';
import { hide } from './hideMiddleware';
import { ownerDocument, ownerWindow } from './owner';
import * as CommonPositionerCssVars from './CommonPositionerCssVars';

const AVAILABLE_WIDTH_VAR = CommonPositionerCssVars.availableWidth;
const AVAILABLE_HEIGHT_VAR = CommonPositionerCssVars.availableHeight;

function getLogicalSide(sideParam: Side, renderedSide: PhysicalSide, isRtl: boolean): Side {
  const isLogicalSideParam = sideParam === 'inline-start' || sideParam === 'inline-end';
  const logicalRight = isRtl ? 'inline-start' : 'inline-end';
  const logicalLeft = isRtl ? 'inline-end' : 'inline-start';
  return (
    {
      bottom: 'bottom',
      left: isLogicalSideParam ? logicalLeft : 'left',
      right: isLogicalSideParam ? logicalRight : 'right',
      top: 'top',
    } satisfies Record<PhysicalSide, Side>
  )[renderedSide];
}

function getOffsetData(state: MiddlewareState, sideParam: Side, isRtl: boolean) {
  const { rects, placement } = state;
  const data = {
    align: getAlignment(placement) || 'center',
    anchor: { height: rects.reference.height, width: rects.reference.width },
    positioner: { height: rects.floating.height, width: rects.floating.width },
    side: getLogicalSide(sideParam, getSide(placement), isRtl),
  } as const;
  return data;
}

export type Side = 'top' | 'bottom' | 'left' | 'right' | 'inline-end' | 'inline-start';
export type Align = 'start' | 'center' | 'end';
export type Boundary = 'clipping-ancestors' | Element | Element[] | Rect;
export type OffsetFunction = (data: {
  side: Side;
  align: Align;
  anchor: { width: number; height: number };
  positioner: { width: number; height: number };
}) => number;

interface SideFlipMode {
  /**
   * How to avoid collisions on the side axis.
   */
  side?: ('flip' | 'none') | undefined;
  /**
   * How to avoid collisions on the align axis.
   */
  align?: ('flip' | 'shift' | 'none') | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   */
  fallbackAxisSide?: ('start' | 'end' | 'none') | undefined;
}

interface SideShiftMode {
  /**
   * How to avoid collisions on the side axis.
   */
  side?: ('shift' | 'none') | undefined;
  /**
   * How to avoid collisions on the align axis.
   */
  align?: ('shift' | 'none') | undefined;
  /**
   * If both sides on the preferred axis do not fit, determines whether to fallback
   * to a side on the perpendicular axis and which logical side to prefer.
   */
  fallbackAxisSide?: ('start' | 'end' | 'none') | undefined;
}

export type CollisionAvoidance = SideFlipMode | SideShiftMode;

/**
 * Provides standardized anchor positioning behavior for floating elements. Wraps Floating UI's
 * `useFloating` hook.
 */

export function useAnchorPositioning(
  params: UseAnchorPositioningParameters,
): UseAnchorPositioningReturnValue {
  // Public parameters
  const anchor = createMemo(() => access(params.anchor));
  const positionMethod = () => access(params.positionMethod) ?? 'absolute';
  const sideParam = () => access(params.side) ?? 'bottom';
  const sideOffset = () => access(params.sideOffset) ?? 0;
  const align = () => access(params.align) ?? 'center';
  const alignOffset = () => access(params.alignOffset) ?? 0;
  const collisionBoundary = () => access(params.collisionBoundary);
  const collisionPaddingParam = () => access(params.collisionPadding) ?? 5;
  const sticky = () => access(params.sticky) ?? false;
  const arrowPadding = () => access(params.arrowPadding) ?? 5;
  const disableAnchorTracking = () => access(params.disableAnchorTracking) ?? false;
  // Private parameters
  const keepMounted = () => access(params.keepMounted) ?? false;
  const mounted = () => access(params.mounted);
  const collisionAvoidance = () => access(params.collisionAvoidance);
  const shift = () => access(params.shift);
  const nodeId = () => access(params.nodeId);
  const adaptiveOrigin = () => access(params.adaptiveOrigin);
  const lazyFlip = () => access(params.lazyFlip) ?? false;

  // React resets the locked side during render once the popup unmounts. Solid derives the reset:
  // the lock written below stands while mounted.
  const [mountSide, setMountSide] = createSignal<PhysicalSide | null>((prev) =>
    mounted() ? (prev ?? null) : null,
  );

  const collisionAvoidanceSide = () => collisionAvoidance().side || 'flip';
  const collisionAvoidanceAlign = () => collisionAvoidance().align || 'flip';
  const collisionAvoidanceFallbackAxisSide = () => collisionAvoidance().fallbackAxisSide || 'end';
  const shiftCrossAxis = () => shift()?.crossAxis ?? false;
  const shiftRootBoundary = () => shift()?.rootBoundary;

  const direction = useDirection();
  const isRtl = () => direction() === 'rtl';

  // The requested side, before a lazy-flip lock.
  const baseSide = createMemo(
    () =>
      (
        ({
          top: 'top',
          right: 'right',
          bottom: 'bottom',
          left: 'left',
          'inline-end': isRtl() ? 'left' : 'right',
          'inline-start': isRtl() ? 'right' : 'left',
        }) satisfies Record<Side, PhysicalSide>
      )[sideParam()],
  );
  const side = createMemo(() => mountSide() || baseSide());

  const placement = () => (align() === 'center' ? side() : (`${side()}-${align()}` as Placement));

  const collisionPadding = createMemo(() => {
    let collisionPaddingValue = collisionPaddingParam() as {
      top: number;
      right: number;
      bottom: number;
      left: number;
    };

    if (typeof collisionPaddingValue === 'number') {
      collisionPaddingValue = {
        top: collisionPaddingValue,
        right: collisionPaddingValue,
        bottom: collisionPaddingValue,
        left: collisionPaddingValue,
      };
    } else if (collisionPaddingValue) {
      collisionPaddingValue = {
        top: collisionPaddingValue.top || 0,
        right: collisionPaddingValue.right || 0,
        bottom: collisionPaddingValue.bottom || 0,
        left: collisionPaddingValue.left || 0,
      };
    }

    return collisionPaddingValue;
  });

  // Create a bias to the preferred side.
  // On iOS, when the mobile software keyboard opens, the input is exactly centered
  // in the viewport, but this can cause it to flip to the top undesirably.
  // The bias is only applied to `flip()` so it doesn't shift the resting position
  // computed by `shift()` and `size()` away from the requested `collisionPadding`.
  const bias = 1;
  const biasTop = () => (sideParam() === 'bottom' ? bias : 0);
  const biasBottom = () => (sideParam() === 'top' ? bias : 0);
  const biasLeft = () => (sideParam() === 'right' ? bias : 0);
  const biasRight = () => (sideParam() === 'left' ? bias : 0);

  const commonCollisionProps = createMemo(() => {
    const boundary = collisionBoundary();
    return {
      boundary: boundary === 'clipping-ancestors' ? 'clippingAncestors' : boundary,
      padding: collisionPadding(),
    } as const;
  });

  // Using a ref assumes that the arrow element is always present in the DOM for the lifetime of the
  // popup. If this assumption ends up being false, we can switch to state to manage the arrow's
  // presence.
  const arrowRef = useRef<Element | null | undefined>(null);

  // Solid: offsets are read when the middleware runs, as React keeps them in refs.
  const offsetMiddleware = createMemo<Middleware>(() => {
    const currentSideParam = sideParam();
    const rtl = isRtl();
    // Rebuild when non-function offsets change (React's middleware deps).
    const sideOffsetDep = sideOffset();
    const alignOffsetDep = alignOffset();
    void sideOffsetDep;
    void alignOffsetDep;

    return offset((state) => {
      const data = getOffsetData(state, currentSideParam, rtl);
      const sideOffsetValue = untrack(sideOffset);
      const alignOffsetValue = untrack(alignOffset);

      const sideAxis =
        typeof sideOffsetValue === 'function' ? sideOffsetValue(data) : sideOffsetValue;
      const alignAxis =
        typeof alignOffsetValue === 'function' ? alignOffsetValue(data) : alignOffsetValue;

      return {
        mainAxis: sideAxis,
        crossAxis: alignAxis,
        alignmentAxis: alignAxis,
      };
    });
  });

  const shiftDisabled = () =>
    collisionAvoidanceAlign() === 'none' && collisionAvoidanceSide() !== 'shift';
  const crossAxisShiftEnabled = () =>
    !shiftDisabled() && (sticky() || shiftCrossAxis() || collisionAvoidanceSide() === 'shift');

  const flipMiddleware = createMemo<Middleware | null>(() => {
    const collisionPaddingValue = collisionPadding();
    return collisionAvoidanceSide() === 'none'
      ? null
      : flip({
          ...commonCollisionProps(),
          // Ensure the popup flips if it's been limited by its --available-height and it resizes.
          // Since the size() padding is smaller than the flip() padding, flip() will take precedence.
          padding: {
            top: collisionPaddingValue.top + bias + biasTop(),
            right: collisionPaddingValue.right + bias + biasRight(),
            bottom: collisionPaddingValue.bottom + bias + biasBottom(),
            left: collisionPaddingValue.left + bias + biasLeft(),
          },
          mainAxis: !shiftCrossAxis() && collisionAvoidanceSide() === 'flip',
          crossAxis: collisionAvoidanceAlign() === 'flip' ? 'alignment' : false,
          fallbackAxisSideDirection: collisionAvoidanceFallbackAxisSide(),
        });
  });

  const shiftMiddleware = createMemo<Middleware | null>(() => {
    const collisionPaddingValue = collisionPadding();
    return shiftDisabled()
      ? null
      : floatingShift({
          ...commonCollisionProps(),
          // Use the Layout Viewport to avoid shifting around when pinch-zooming.
          rootBoundary: shiftRootBoundary(),
          mainAxis: collisionAvoidanceAlign() !== 'none',
          crossAxis: crossAxisShiftEnabled(),
          limiter:
            sticky() || shiftCrossAxis()
              ? undefined
              : limitShift((limitData) => {
                  if (!arrowRef.current) {
                    return {};
                  }
                  const { width, height } = arrowRef.current.getBoundingClientRect();
                  const sideAxis = getSideAxis(getSide(limitData.placement));
                  const arrowSize = sideAxis === 'y' ? width : height;
                  const offsetAmount =
                    sideAxis === 'y'
                      ? collisionPaddingValue.left + collisionPaddingValue.right
                      : collisionPaddingValue.top + collisionPaddingValue.bottom;
                  return {
                    offset: arrowSize / 2 + offsetAmount / 2,
                  };
                }),
        });
  });

  const sizeMiddleware = createMemo<Middleware>(() =>
    size({
      ...commonCollisionProps(),
      apply({ elements: { floating }, availableWidth, availableHeight, rects }) {
        if (!untrack(mounted)) {
          return;
        }

        const floatingStyle = floating.style;
        floatingStyle.setProperty(AVAILABLE_WIDTH_VAR, `${availableWidth}px`);
        floatingStyle.setProperty(AVAILABLE_HEIGHT_VAR, `${availableHeight}px`);

        // Snap anchor dimensions to device pixels to ensure the popup's visual width matches the anchor's one.
        const dpr = ownerWindow(floating).devicePixelRatio || 1;
        const { x, y, width, height } = rects.reference;
        const anchorWidth = (Math.round((x + width) * dpr) - Math.round(x * dpr)) / dpr;
        const anchorHeight = (Math.round((y + height) * dpr) - Math.round(y * dpr)) / dpr;

        floatingStyle.setProperty(CommonPositionerCssVars.anchorWidth, `${anchorWidth}px`);
        floatingStyle.setProperty(CommonPositionerCssVars.anchorHeight, `${anchorHeight}px`);
      },
    }),
  );

  const arrowMiddleware = createMemo<Middleware>(() => {
    const arrowPaddingValue = arrowPadding();
    return arrow((state) => ({
      // `transform-origin` calculations rely on an element existing. If the arrow hasn't been set,
      // we'll create a fake element.
      element: arrowRef.current || ownerDocument(state.elements.floating).createElement('div'),
      // No padding for the fake arrow: it would displace aligned popups on narrow anchors.
      padding: arrowRef.current ? arrowPaddingValue : 0,
      offsetParent: 'floating',
    }));
  });

  const transformOriginMiddleware: Middleware = {
    name: 'transformOrigin',
    fn(state) {
      const {
        elements: { floating },
        middlewareData,
        placement: renderedPlacement,
        platform,
        rects,
        y,
      } = state;

      const renderedSide = getSide(renderedPlacement);
      const renderedAlign = getAlignment(renderedPlacement);
      const isVertical = getSideAxis(renderedSide) === 'y';
      const arrowEl = arrowRef.current;

      const sideOffsetResolved = untrack(sideOffset);
      const sideOffsetValue =
        typeof sideOffsetResolved === 'function'
          ? sideOffsetResolved(getOffsetData(state, untrack(sideParam), untrack(isRtl)))
          : sideOffsetResolved;

      // An aligned arrowless popup grows from its aligned edge, until a shift (beyond subpixel)
      // breaks its alignment with the anchor. Everything else grows from the arrow, real or fake.
      let crossOrigin: string;
      if (
        !arrowEl &&
        renderedAlign &&
        Math.abs(isVertical ? middlewareData.shift?.x || 0 : middlewareData.shift?.y || 0) <= 1
      ) {
        // The platform direction, not `isRtl`: it must match what Floating UI placed with.
        crossOrigin =
          (renderedAlign === 'start') === (isVertical && platform.isRTL?.(floating) === true)
            ? '100%'
            : '0%';
      } else {
        const arrowOffset = isVertical
          ? middlewareData.arrow?.x || 0
          : middlewareData.arrow?.y || 0;
        const arrowSize = isVertical ? arrowEl?.clientWidth || 0 : arrowEl?.clientHeight || 0;
        crossOrigin = `${arrowOffset + arrowSize / 2}px`;
      }

      // Side axis: the anchor-facing edge, or the anchor's center when the popup overlaps it.
      let sideOrigin =
        renderedSide === 'top' || renderedSide === 'left'
          ? `calc(100% + ${sideOffsetValue}px)`
          : `${-sideOffsetValue}px`;
      if (
        untrack(crossAxisShiftEnabled) &&
        isVertical &&
        Math.abs(middlewareData.shift?.y || 0) > sideOffsetValue
      ) {
        sideOrigin = `${rects.reference.y + rects.reference.height / 2 - y}px`;
      }

      floating.style.setProperty(
        CommonPositionerCssVars.transformOrigin,
        isVertical ? `${crossOrigin} ${sideOrigin}` : `${sideOrigin} ${crossOrigin}`,
      );

      return {};
    },
  };

  const middleware = createMemo(() => {
    const middlewareArray: MaybeAccessorValue<UseFloatingOptions['middleware']> = [];

    const inlineMiddleware = access(params.inline);
    if (inlineMiddleware) {
      middlewareArray.push(inlineMiddleware);
    }

    middlewareArray.push(offsetMiddleware());

    // https://floating-ui.com/docs/flip#combining-with-shift
    if (
      collisionAvoidanceSide() === 'shift' ||
      collisionAvoidanceAlign() === 'shift' ||
      align() === 'center'
    ) {
      middlewareArray.push(shiftMiddleware(), flipMiddleware());
    } else {
      middlewareArray.push(flipMiddleware(), shiftMiddleware());
    }

    middlewareArray.push(
      sizeMiddleware(),
      arrowMiddleware(),
      transformOriginMiddleware,
      hide,
      adaptiveOrigin(),
    );

    return middlewareArray;
  });

  // Ensure positioning doesn't run initially for `keepMounted` elements that aren't initially open.
  // React clears the root's elements in a layout effect once unmounted; Solid derives it, so the
  // elements read `null` in the same flush as `mounted`.
  untrack(() => params.floatingRootContext)?.useSyncedValue('elementsMounted', mounted);

  const autoUpdateOptions = createMemo<AutoUpdateOptions>(() => ({
    ancestorScroll: !disableAnchorTracking(),
    elementResize: !disableAnchorTracking() && typeof ResizeObserver !== 'undefined',
    layoutShift: !disableAnchorTracking() && typeof IntersectionObserver !== 'undefined',
  }));

  const {
    refs,
    elements,
    x,
    y,
    middlewareData,
    update,
    placement: renderedPlacement,
    context,
    isPositioned,
    floatingStyles: originalFloatingStyles,
  } = useFloating({
    get rootContext() {
      return params.floatingRootContext;
    },
    get open() {
      return keepMounted() ? mounted() : undefined;
    },
    get placement() {
      return placement();
    },
    get middleware() {
      return middleware();
    },
    get strategy() {
      return positionMethod();
    },
    get whileElementsMounted(): UseFloatingOptions['whileElementsMounted'] {
      if (keepMounted()) {
        return undefined;
      }

      return (...args) => untrack(() => autoUpdate(...args, autoUpdateOptions()));
    },
    get nodeId() {
      return nodeId();
    },
    get externalTree() {
      return params.externalTree;
    },
  });

  // Default to `fixed` when not positioned to prevent `autoFocus` scroll jumps.
  // This ensures the popup is inside the viewport initially before it gets positioned.
  const resolvedPosition = createMemo<'absolute' | 'fixed'>(() =>
    isPositioned() ? positionMethod() : 'fixed',
  );

  const floatingStyles = createMemo<JSX.CSSProperties>(() => {
    let base: JSX.CSSProperties & Record<string, unknown>;
    if (!isPositioned()) {
      // Until a position for the current open is computed, ignore any coordinates retained from a
      // previous open (or from a pass that measured the hidden popup as 0x0). Rendering the
      // full-size popup at such stale coordinates can overflow the layout viewport, which makes
      // mobile Chrome zoom the page out and reflow everything the popup is anchored to.
      base = { position: resolvedPosition(), top: '0px', left: '0px' };
    } else if (adaptiveOrigin()) {
      const { sideX, sideY } = middlewareData().adaptiveOrigin || DEFAULT_SIDES;
      base = { position: resolvedPosition(), [sideX]: `${x()}px`, [sideY]: `${y()}px` };
    } else {
      base = { ...originalFloatingStyles(), position: resolvedPosition() };
    }

    // Seed the available size vars so consumer `max-height: min(x, var(--available-height))` rules
    // resolve to a valid length on the first positioning pass, before `size()` writes the real
    // values. Seeded unconditionally so the keys stay present with a constant value and the style
    // binding never rewrites them after mount, preserving the px values `size()` sets imperatively.
    base[AVAILABLE_WIDTH_VAR] = '100vw';
    base[AVAILABLE_HEIGHT_VAR] = '100vh';

    if (!isPositioned()) {
      base.opacity = 0;
    }
    return base;
  });

  let registeredPositionReferenceRef: Element | VirtualElement | null = null;

  // Resolves the `anchor` param: a Solid accessor (called, tracked), a ref (`.current`, read when
  // the effect runs, as React reads refs after commit), or an element/virtual element.
  // Solid: one effect covers React's layout effect and its ref-reading passive effect.
  function unwrapAnchor(value: unknown): Element | VirtualElement | null {
    const isReactLikeRef =
      value != null && typeof value === 'object' && 'current' in (value as object);
    const resolved = isReactLikeRef ? (value as { current: unknown }).current : value;
    return (resolved as Element | VirtualElement | null | undefined) || null;
  }

  createEffect(
    () => {
      if (!mounted()) {
        return null;
      }
      const anchorValue = anchor();
      // A callable ref (ReactLikeRef function with `.current`) is a ref, not an accessor.
      const isCallableRef =
        typeof anchorValue === 'function' && 'current' in (anchorValue as { current?: unknown });
      return {
        value:
          typeof anchorValue === 'function' && !isCallableRef
            ? (anchorValue as () => unknown)()
            : anchorValue,
      };
    },
    (target) => {
      if (!target) {
        return;
      }
      const finalAnchor = unwrapAnchor(target.value);

      if (finalAnchor !== registeredPositionReferenceRef) {
        refs.setPositionReference(finalAnchor);
        registeredPositionReferenceRef = finalAnchor;
      }
    },
  );

  createDepsEffect(
    () => ({
      active: keepMounted() && mounted(),
      reference: elements.reference(),
      floating: elements.floating(),
      options: autoUpdateOptions(),
    }),
    (deps) => {
      if (deps.active && deps.reference && deps.floating) {
        return autoUpdate(deps.reference, deps.floating, update, deps.options);
      }
      return undefined;
    },
  );

  const renderedSide = () => getSide(renderedPlacement());
  const logicalRenderedSide = () => getLogicalSide(sideParam(), renderedSide(), isRtl());
  const renderedAlign = () => getAlignment(renderedPlacement()) || 'center';
  const anchorHidden = () => Boolean(middlewareData().hide?.referenceHidden);

  // Locks the flip (makes it "sticky") so it doesn't prefer a given placement
  // and flips back lazily, not eagerly. Ideal for filtered lists that change
  // the size of the popup dynamically to avoid unwanted flipping when typing.
  createEffect(
    () =>
      lazyFlip() && mounted() && isPositioned() && renderedSide() !== baseSide()
        ? renderedSide()
        : null,
    (sideToLock) => {
      if (sideToLock !== null) {
        setMountSide(sideToLock);
      }
    },
  );

  // Solid: style values need explicit units.
  // Solid: equal style objects keep the memo closed (React keeps them via `useMemo` deps).
  const arrowStyles = createMemo<JSX.CSSProperties>(
    () => {
      const arrowData = middlewareData().arrow;
      return {
        position: 'absolute',
        top: arrowData?.y == null ? undefined : `${arrowData.y}px`,
        left: arrowData?.x == null ? undefined : `${arrowData.x}px`,
      };
    },
    { equals: shallowEqual },
  );

  const arrowUncentered = () => middlewareData().arrow?.centerOffset !== 0;

  return {
    positionerStyles: floatingStyles,
    arrowStyles,
    arrowRef,
    arrowUncentered,
    side: logicalRenderedSide,
    align: renderedAlign,
    physicalSide: renderedSide,
    anchorHidden,
    context,
    isPositioned,
    update,
  };
}

export interface UseAnchorPositioningSharedParameters {
  /**
   * An element to position the popup against.
   * By default, the popup will be positioned against the trigger.
   */
  anchor?:
    | (Element | null | VirtualElement | (() => Element | VirtualElement | null | undefined))
    | undefined;
  /**
   * Determines which CSS `position` property to use.
   * @default 'absolute'
   */
  positionMethod?: ('absolute' | 'fixed') | undefined;
  /**
   * Which side of the anchor element to align the popup against.
   * May automatically change to avoid collisions.
   * @default 'bottom'
   */
  side?: Side | undefined;
  /**
   * Distance between the anchor and the popup in pixels.
   * Also accepts a function that returns the distance to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   sideOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.height
   *       : anchor.width;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  sideOffset?: (number | OffsetFunction) | undefined;
  /**
   * How to align the popup relative to the specified side.
   * @default 'center'
   */
  align?: Align | undefined;
  /**
   * Additional offset along the alignment axis in pixels.
   * Also accepts a function that returns the offset to read the dimensions of the anchor
   * and positioner elements, along with its side and alignment.
   *
   * The function takes a `data` object parameter with the following properties:
   * - `data.anchor`: the dimensions of the anchor element with properties `width` and `height`.
   * - `data.positioner`: the dimensions of the positioner element with properties `width` and `height`.
   * - `data.side`: which side of the anchor element the positioner is aligned against.
   * - `data.align`: how the positioner is aligned relative to the specified side.
   *
   * @example
   * ```jsx
   * <Positioner
   *   alignOffset={({ side, align, anchor, positioner }) => {
   *     return side === 'top' || side === 'bottom'
   *       ? anchor.width
   *       : anchor.height;
   *   }}
   * />
   * ```
   *
   * @default 0
   */
  alignOffset?: (number | OffsetFunction) | undefined;
  /**
   * An element or a rectangle that delimits the area that the popup is confined to.
   * @default 'clipping-ancestors'
   */
  collisionBoundary?: Boundary | undefined;
  /**
   * Additional space to maintain from the edge of the collision boundary.
   * @default 5
   */
  collisionPadding?: Padding | undefined;
  /**
   * Whether to maintain the popup in the viewport after
   * the anchor element was scrolled out of view.
   * @default false
   */
  sticky?: boolean | undefined;
  /**
   * Minimum distance to maintain between the arrow and the edges of the popup.
   *
   * Use it to prevent the arrow element from hanging out of the rounded corners of a popup.
   * @default 5
   */
  arrowPadding?: number | undefined;
  /**
   *Whether to disable the popup from tracking any layout shift of its positioning anchor.
   * @default false
   */
  disableAnchorTracking?: boolean | undefined;
  /**
   * Determines how to handle collisions when positioning the popup.
   *
   * @example
   * ```jsx
   * <Positioner
   *   collisionAvoidance={{
   *     side: 'shift',
   *     align: 'shift',
   *     fallbackAxisSide: 'none',
   *   }}
   * />
   * ```
   *
   */
  collisionAvoidance?: CollisionAvoidance | undefined;
}

export interface UseAnchorPositioningParameters extends Accessorify<
  UseAnchorPositioningSharedParameters,
  'maybeAccessor'
> {
  keepMounted?: MaybeAccessor<boolean | undefined>;
  trackCursorAxis?: MaybeAccessor<('none' | 'x' | 'y' | 'both') | undefined>;
  floatingRootContext?: FloatingRootContext | undefined;
  mounted: MaybeAccessor<boolean>;
  disableAnchorTracking: MaybeAccessor<boolean>;
  nodeId?: MaybeAccessor<string | undefined>;
  adaptiveOrigin?: MaybeAccessor<Middleware | undefined>;
  collisionAvoidance: MaybeAccessor<CollisionAvoidance>;
  shift?: MaybeAccessor<UseAnchorPositioningShiftOptions | undefined>;
  lazyFlip?: MaybeAccessor<boolean | undefined>;
  externalTree?: FloatingTreeStore | undefined;
  /**
   * Optional middleware that can replace the measured reference rect before offsets and collision
   * middleware run. Used by Preview Card to position against a specific inline line box.
   */
  inline?: MaybeAccessor<Middleware | undefined>;
}

export interface UseAnchorPositioningShiftOptions {
  crossAxis?: boolean | undefined;
  rootBoundary?: 'layoutViewport' | undefined;
}

export interface UseAnchorPositioningReturnValue {
  positionerStyles: Accessor<JSX.CSSProperties>;
  arrowStyles: Accessor<JSX.CSSProperties>;
  arrowUncentered: Accessor<boolean>;
  side: Accessor<Side>;
  align: Accessor<Align>;
  physicalSide: Accessor<PhysicalSide>;
  anchorHidden: Accessor<boolean>;
  arrowRef: ReactLikeRef<Element | null | undefined>;
  context: FloatingContext;
  isPositioned: Accessor<boolean>;
  update: () => void;
}

export interface UseAnchorPositioningState {}

export namespace useAnchorPositioning {
  export type SharedParameters = UseAnchorPositioningSharedParameters;
  export type Parameters = UseAnchorPositioningParameters;
  export type ReturnValue = UseAnchorPositioningReturnValue;
}
