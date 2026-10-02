import { computePosition } from '@floating-ui/dom';
import {
  createEffect,
  createMemo,
  createSignal,
  onSettled,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access, defaultProps } from '../../solid-helpers';
import type {
  ComputePositionConfig,
  ComputePositionReturn,
  Prettify,
  ReferenceType,
  UseFloatingOptions,
} from '../types';
import { on, createStore } from '../../solid-1-compat';

export type UsePositionData = ComputePositionReturn & { isPositioned: boolean };

export type UsePositionOptions<RT extends ReferenceType = ReferenceType> = Prettify<
  Partial<ComputePositionConfig> & {
    /**
     * A callback invoked when both the reference and floating elements are
     * mounted, and cleaned up when either is unmounted. This is useful for
     * setting up event listeners (e.g. pass `autoUpdate`).
     */
    whileElementsMounted?: (reference: RT, floating: HTMLElement, update: () => void) => () => void;

    /**
     * Object containing the reference and floating elements.
     */
    elements?: {
      reference?: RT | null | undefined;
      floating?: HTMLElement | null | undefined;
    };
    /**
     * The `open` state of the floating element to synchronize with the
     * `isPositioned` value.
     * @default false
     */
    open?: boolean | undefined;
    /**
     * Whether to use `transform` for positioning instead of `top` and `left`
     * (layout) in the `floatingStyles` object.
     * @default true
     */
    transform?: boolean | undefined;
  }
>;

export interface UsePositionFloatingSharedReturn extends UsePositionData {
  /**
   * Update the position of the floating element, re-rendering the component
   * if required.
   */
  update: () => void;
  /**
   * Pre-configured positioning styles to apply to the floating element.
   */
  floatingStyles: JSX.CSSProperties;
}

export type UsePositionFloatingReturn<RT extends ReferenceType = ReferenceType> = Prettify<
  UsePositionFloatingSharedReturn & {
    refs: {
      /**
       * A Solid ref to the reference element.
       */
      reference: Accessor<RT | null | undefined>;
      /**
       * A Solid ref to the floating element.
       */
      floating: Accessor<HTMLElement | null | undefined>;
      /**
       * A callback to set the reference element (reactive).
       */
      setReference: (value: RT | null | undefined) => void;
      /**
       * A callback to set the floating element (reactive).
       */
      setFloating: (value: HTMLElement | null | undefined) => void;
    };
    /**
     * Object containing the reference and floating elements.
     */
    elements: {
      reference: Accessor<RT | null | undefined>;
      floating: Accessor<HTMLElement | null | undefined>;
    };
  }
>;

/**
 * @internal
 * This is a Solid port of the React useFloating hook
 * https://github.com/floating-ui/floating-ui/blob/3286d01bc1425150ad5aaa22aee062fe70fa8f5c/packages/react-dom/src/useFloating.ts
 */
export function useFloatingOriginal<RT extends ReferenceType = ReferenceType>(
  options: UseFloatingOptions = {},
): UsePositionFloatingReturn<RT> {
  const props = defaultProps(options, {
    middleware: [],
    placement: 'bottom',
    strategy: 'absolute',
    transform: true,
  });

  const [data, setData] = createStore<UsePositionData>({
    isPositioned: false,
    middlewareData: {},
    placement: access(props.placement),
    strategy: access(props.strategy),
    x: 0,
    y: 0,
  });

  const [reference, setReference] = createSignal<RT | null | undefined>(null);
  const [floating, setFloating] = createSignal<HTMLElement | null | undefined>(null);

  const referenceEl = createMemo(
    () => (props.elements?.reference as RT | null | undefined) ?? reference(),
  );
  const floatingEl = createMemo(() => props.elements?.floating ?? floating());

  let isMountedRef = false;

  function update() {
    const r = referenceEl();
    const f = floatingEl();
    if (!r || !f) {
      return;
    }

    const config: ComputePositionConfig = {
      middleware: props.middleware,
      placement: props.placement,
      strategy: props.strategy,
    };

    const platform = options.platform;
    if (platform) {
      config.platform = platform;
    }

    computePosition(r, f, config).then((computedData) => {
      if (isMountedRef) {
        setData({
          ...computedData,
          // The floating element's position may be recomputed while it's closed
          // but still mounted (such as when transitioning out). To ensure
          // `isPositioned` will be `false` initially on the next open, avoid
          // setting it to `true` when `open === false` (must be specified).
          isPositioned: options.open !== false,
        });
      }
    });
  }

  createEffect(
    () => options.open === false && data.isPositioned,
    (shouldReset) => {
      if (shouldReset) {
        setData('isPositioned', false);
      }
    },
  );

  onSettled(() => {
    const _c: Array<() => void> = [];
    (() => {

    isMountedRef = true;

    _c.push(() => {
      isMountedRef = false;
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createEffect(...on([referenceEl, floatingEl, () => props.whileElementsMounted, () => options.open], () => {
      const r = referenceEl();
      const f = floatingEl();
      if (r && f) {
        if (props.whileElementsMounted) {
          return props.whileElementsMounted(r, f, update);
        }

        update();
      }
    }),
  );

  const refs = {
    floating,
    reference,
    setFloating,
    setReference,
  };

  const elements = { floating: floatingEl, reference: referenceEl };

  const floatingStyles = createMemo<JSX.CSSProperties>(() => {
    const initialStyles: JSX.CSSProperties = {
      left: 0,
      position: props.strategy,
      top: 0,
    };

    const el = elements.floating();
    if (!el) {
      return initialStyles;
    }

    const x = roundByDPR(el, data.x);
    const y = roundByDPR(el, data.y);

    if (props.transform) {
      return {
        ...initialStyles,
        transform: `translate(${x}px, ${y}px)`,
        ...(getDPR(el) >= 1.5 && { willChange: 'transform' }),
      };
    }

    return {
      left: `${x}px`,
      position: props.strategy,
      top: `${y}px`,
    };
  });

  return {
    elements,
    get floatingStyles() {
      return floatingStyles();
    },
    get isPositioned() {
      return data.isPositioned;
    },
    get middlewareData() {
      return data.middlewareData;
    },
    get placement() {
      return data.placement;
    },
    refs,
    get strategy() {
      return data.strategy;
    },
    update,
    get x() {
      return data.x;
    },
    get y() {
      return data.y;
    },
  };
}

/**
 * This is a Solid port of the React roundByDPR function
 * https://github.com/floating-ui/floating-ui/blob/3286d01bc1425150ad5aaa22aee062fe70fa8f5c/packages/react-dom/src/utils/roundByDPR.ts
 */
function roundByDPR(element: Element, value: number) {
  const dpr = getDPR(element);
  return Math.round(value * dpr) / dpr;
}

/**
 * This is a Solid port of the React getDPR function
 * https://github.com/floating-ui/floating-ui/blob/3286d01bc1425150ad5aaa22aee062fe70fa8f5c/packages/react-dom/src/utils/getDPR.ts
 */
function getDPR(element: Element): number {
  if (typeof window === 'undefined') {
    return 1;
  }
  const win = element.ownerDocument.defaultView || window;
  return win.devicePixelRatio || 1;
}
