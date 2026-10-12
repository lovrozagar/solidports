import { createEffect, createMemo, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { Dimensions } from '../floating-ui-solid/types';
import { access, type MaybeAccessor } from '../solid-helpers';
import { EMPTY_OBJECT } from './constants';
import { NOOP } from './empty';
import { getCssDimensions } from './getCssDimensions';
import type { Side } from './useAnchorPositioning';
import { useAnimationFrame } from './useAnimationFrame';
import { useAnimationsFinished } from './useAnimationsFinished';
import * as CommonPopupCssVars from './CommonPopupCssVars';
import * as CommonPositionerCssVars from './CommonPositionerCssVars';

/**
 * Allows the element to automatically resize based on its content while supporting animations.
 */
export function usePopupAutoResize(parameters: UsePopupAutoResizeParameters) {
  const popupElement = () => access(parameters.popupElement);
  const positionerElement = () => access(parameters.positionerElement);

  const runOnceAnimationsFinish = useAnimationsFinished(parameters.popupElement, true, false);

  const animationFrame = useAnimationFrame();

  let committedDimensions: Dimensions | null = null;

  const anchoringStyles = createMemo(() =>
    getPopupAnchoringStyles(access(parameters.side), access(parameters.direction)),
  );

  createEffect(
    () => ({
      mounted: access(parameters.mounted),
      // Read for its change only: new content triggers a resize.
      content: access(parameters.content),
      popupElement: popupElement(),
      positionerElement: positionerElement(),
      anchoringStyles: anchoringStyles(),
    }),
    (deps) => {
      // Reset the state when the popup is closed.
      if (!deps.mounted) {
        committedDimensions = null;
        return undefined;
      }

      const popupEl = deps.popupElement;
      const positionerEl = deps.positionerElement;
      if (!popupEl || !positionerEl) {
        return undefined;
      }

      const restoreAnchoringStyles = applyElementStyles(
        popupEl,
        deps.anchoringStyles as Record<string, string>,
      );

      // Measure the rendered size to enable transitions:
      setPopupCssSize(popupEl, 'auto');

      const restorePopupPosition = overrideElementStyle(popupEl, 'position', 'static');
      const restorePopupTransform = overrideElementStyle(popupEl, 'transform', 'none');
      const restorePopupScale = overrideElementStyle(popupEl, 'scale', '1');
      const restorePositionerAvailableSize = applyElementStyles(positionerEl, {
        [CommonPositionerCssVars.availableWidth]: 'max-content',
        [CommonPositionerCssVars.availableHeight]: 'max-content',
      });

      function restoreMeasurementOverrides() {
        restorePopupPosition();
        restorePopupTransform();
        restorePositionerAvailableSize();
        restorePopupScale();
      }

      untrack(() => parameters.onMeasureLayout)?.();

      // Initial render (for each time the popup opens).
      if (committedDimensions === null) {
        setPositionerCssSize(positionerEl, 'max-content');

        const dimensions = getCssDimensions(popupEl);

        committedDimensions = dimensions;

        setPositionerCssSize(positionerEl, dimensions);
        restoreMeasurementOverrides();
        untrack(() => parameters.onMeasureLayoutComplete)?.(null, dimensions);

        return restoreAnchoringStyles;
      }

      // Subsequent renders while open (when `content` changes).
      setPositionerCssSize(positionerEl, 'max-content');

      const previousDimensions = committedDimensions;
      const newDimensions = getCssDimensions(popupEl);

      // Commit immediately so future content changes have a stable previous size.
      committedDimensions = newDimensions;

      setPopupCssSize(popupEl, previousDimensions);
      restoreMeasurementOverrides();
      untrack(() => parameters.onMeasureLayoutComplete)?.(previousDimensions, newDimensions);

      setPositionerCssSize(positionerEl, newDimensions);

      const abortController = new AbortController();

      animationFrame.request(() => {
        setPopupCssSize(popupEl, newDimensions);

        runOnceAnimationsFinish(() => {
          popupEl.style.setProperty(CommonPopupCssVars.popupWidth, 'auto');
          popupEl.style.setProperty(CommonPopupCssVars.popupHeight, 'auto');
        }, abortController.signal);
      });

      return () => {
        abortController.abort();
        animationFrame.cancel();
        restoreAnchoringStyles();
      };
    },
  );
}

interface UsePopupAutoResizeParameters {
  /**
   * Element to resize.
   */
  popupElement: MaybeAccessor<HTMLElement | null | undefined>;
  /*
   * Positioner element (parent of the popup)
   */
  positionerElement: MaybeAccessor<HTMLElement | null | undefined>;
  /**
   * Whether the popup is mounted.
   */
  mounted: MaybeAccessor<boolean>;
  /*
   * Content that may change and trigger a resize.
   * This doesn't have to be the actual content of the popup, but a value that triggers a resize.
   */
  content: MaybeAccessor<unknown>;
  /**
   * Callback fired immediately before measuring the dimensions of the new content.
   */
  onMeasureLayout?: (() => void) | undefined;
  /**
   * Callback fired after the new dimensions have been measured.
   *
   * @param previousDimensions Dimensions before the change, or `null` if this is the first measurement.
   * @param newDimensions Newly measured dimensions.
   */
  onMeasureLayoutComplete?:
    ((previousDimensions: Dimensions | null, newDimensions: Dimensions) => void) | undefined;

  side: MaybeAccessor<Side>;
  direction: MaybeAccessor<'ltr' | 'rtl'>;
}

function getPopupAnchoringStyles(side: Side, direction: 'ltr' | 'rtl'): JSX.CSSProperties {
  // Ensure popup size transitions correctly when anchored to `bottom` (side=top) or `right` (side=left).
  const isPhysicalTop = side === 'top';
  const isPhysicalLeft =
    side === 'left' || side === (direction === 'rtl' ? 'inline-end' : 'inline-start');

  if (!isPhysicalTop && !isPhysicalLeft) {
    return EMPTY_OBJECT;
  }

  return {
    position: 'absolute',
    [isPhysicalTop ? 'bottom' : 'top']: '0',
    [isPhysicalLeft ? 'right' : 'left']: '0',
  };
}

function overrideElementStyle(element: HTMLElement, property: string, value: string) {
  const originalValue = element.style.getPropertyValue(property);
  element.style.setProperty(property, value);

  return () => {
    element.style.setProperty(property, originalValue);
  };
}

function applyElementStyles(element: HTMLElement, styles: Record<string, string>) {
  const restorers: Array<() => void> = [];

  for (const [key, value] of Object.entries(styles)) {
    restorers.push(overrideElementStyle(element, key, value));
  }

  return restorers.length
    ? () => {
        restorers.forEach((restore) => restore());
      }
    : NOOP;
}

function setPopupCssSize(popupElement: HTMLElement, size: Dimensions | 'auto') {
  const width = size === 'auto' ? 'auto' : `${size.width}px`;
  const height = size === 'auto' ? 'auto' : `${size.height}px`;
  popupElement.style.setProperty(CommonPopupCssVars.popupWidth, width);
  popupElement.style.setProperty(CommonPopupCssVars.popupHeight, height);
}

function setPositionerCssSize(positionerElement: HTMLElement, size: Dimensions | 'max-content') {
  const width = size === 'max-content' ? 'max-content' : `${size.width}px`;
  const height = size === 'max-content' ? 'max-content' : `${size.height}px`;
  positionerElement.style.setProperty(CommonPositionerCssVars.positionerWidth, width);
  positionerElement.style.setProperty(CommonPositionerCssVars.positionerHeight, height);
}
