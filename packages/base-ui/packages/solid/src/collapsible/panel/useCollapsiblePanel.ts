import {
  createEffect,
  createMemo,
  createRenderEffect,
  createSignal,
  onCleanup,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import {
  access,
  createDepsEffect,
  createDepsRenderEffect,
  type MaybeAccessor,
} from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerWindow } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import { HTMLProps } from '../../utils/types';
import { AnimationFrame } from '../../utils/useAnimationFrame';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import { useOpenChangeComplete } from '../../utils/useOpenChangeComplete';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { warn } from '../../utils/warn';
import type { CollapsibleRoot } from '../root/CollapsibleRoot';
import { CollapsiblePanelDataAttributes } from './CollapsiblePanelDataAttributes';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

export function useCollapsiblePanel(
  parameters: UseCollapsiblePanelParameters,
): UseCollapsiblePanelReturnValue {
  const hiddenUntilFound = () => access(parameters.hiddenUntilFound);
  const idParam = () => access(parameters.id);
  const keepMounted = () => access(parameters.keepMounted);
  const mounted = () => access(parameters.mounted);
  const open = () => access(parameters.open);
  const transitionStatus = () => access(parameters.transitionStatus);
  const { onOpenChange, setMounted, setOpen } = parameters;

  // Solid: the panel element is a signal so effects run once it is attached, as React's
  // effects run after commit with the ref already set.
  const [panelElement, setPanelElement] = createSignal<HTMLDivElement | null>(null, {
    ownedWrite: true,
  });
  let animationTypeRef: AnimationType | null = null;
  // Measured sizes go straight to the panel's CSS variables: a measurement is a layout read, and
  // writing it to the element skips a reactive round trip and a re-render (React renders it).
  let dimensionsRef: Dimensions = EMPTY_DIMENSIONS;
  let lastMeasuredDimensionsRef: Dimensions = EMPTY_DIMENSIONS;
  // `beforematch` should reveal the matched content immediately, so the next
  // open cycle skips author-defined motion once and then returns to normal.
  let shouldSkipNextOpenRef = false;
  // Keyframe mount animations on initially open panels cause a visible layout
  // shift during the server-rendered first paint, so suppress that first open
  // lifecycle until the panel has been closed once.
  let shouldPreventMountAnimationRef = untrack(open);
  // Solid: there is no React.Activity, so effects are never torn down while state is kept and
  // React's activity-resume suppression has nothing to guard.
  // Some open paths intentionally bypass motion, but the shared root transition
  // status still advances asynchronously. Override the panel to idle so its data
  // attributes and dimension cleanup reflect the immediate open state.
  // A writable memo: an open path that skips motion sets it, and it drops once the shared root
  // transition leaves `starting` (derived, so the override never outlives that frame).
  const [forcePanelIdle, setForcePanelIdle] = createSignal<boolean>((prev) =>
    transitionStatus() === 'starting' ? (prev ?? false) : false,
  );
  let pendingTemporaryStyleRestoreRef: (() => void) | null = null;

  // Only used to handle panel close
  const runOnceCloseAnimationsFinish = useAnimationsFinished(panelElement);

  const hidden = createMemo(() => !open() && !mounted());
  const panelTransitionStatus = createMemo(() => (forcePanelIdle() ? 'idle' : transitionStatus()));
  const shouldPreventOpenAnimation = createMemo(
    () =>
      open() &&
      // This ref is safe to read in a memo: it only changes from committed layout
      // paths while closed, and the memo re-reads it when `open` flips back.
      shouldPreventMountAnimationRef,
  );
  // The size the variables show: a closing keyframe panel restores its last measured pixel size
  // after the live size has been reset back to `auto`.
  function renderedDimensions() {
    return !untrack(open) &&
      untrack(mounted) &&
      animationTypeRef === 'css-animation' &&
      dimensionsRef.height === undefined &&
      dimensionsRef.width === undefined
      ? lastMeasuredDimensionsRef
      : dimensionsRef;
  }

  function applyDimensions() {
    const panel = untrack(panelElement);
    if (!panel) {
      return;
    }
    const { height, width } = renderedDimensions();
    panel.style.setProperty(
      parameters.dimensionCssVars.height,
      height === undefined ? 'auto' : `${height}px`,
    );
    panel.style.setProperty(
      parameters.dimensionCssVars.width,
      width === undefined ? 'auto' : `${width}px`,
    );
  }

  // Re-apply when the inputs of the rendered size change (and once the element attaches).
  createRenderEffect(
    () => [panelElement(), open(), mounted()] as const,
    () => applyDimensions(),
  );

  const shouldPersistHiddenTransitionStyles = createMemo(
    () => hiddenUntilFound() && hidden() && animationTypeRef !== 'css-animation',
  );

  // Most measured dimensions are reused later when CSS keyframe closes need a
  // pixel size after the rendered dimensions have been reset back to `auto`.
  // Passing `false` is only for clearing the current dimensions state.
  function setDimensions(nextDimensions: Dimensions, shouldCacheMeasurement: boolean = true) {
    if (shouldCacheMeasurement) {
      lastMeasuredDimensionsRef = nextDimensions;
    }

    dimensionsRef = nextDimensions;
    applyDimensions();
  }

  function restorePendingTemporaryStyle() {
    pendingTemporaryStyleRestoreRef?.();
    pendingTemporaryStyleRestoreRef = null;
  }

  function setPendingTemporaryStyleRestore(restore: () => void) {
    restorePendingTemporaryStyle();
    pendingTemporaryStyleRestoreRef = () => {
      pendingTemporaryStyleRestoreRef = null;
      restore();
    };
  }

  onCleanup(() => {
    restorePendingTemporaryStyle();
  });

  // Solid: a user effect, so it runs after the panel's DOM (including a render prop's output) has
  // updated, as React's layout effect runs after commit.
  createDepsEffect(
    () => ({
      panel: panelElement(),
      open: open(),
      shouldPreventOpenAnimation: shouldPreventOpenAnimation(),
      transitionStatus: transitionStatus(),
    }),
    ({
      panel,
      open: isOpen,
      shouldPreventOpenAnimation: preventOpenAnimation,
      transitionStatus: status,
    }) => {
      // Not a dependency: open and status changes drive this pass, and it unmounts the panel
      // itself when there is nothing to animate.
      const isMounted = untrack(mounted);
      // Solid: a render function that swaps its element for `null` does not call the ref with
      // `null`, so a detached element stands for React's cleared ref.
      if (!panel || !panel.isConnected) {
        return undefined;
      }

      // `beforematch` can temporarily force a `0s` motion duration so the matched
      // content reveals immediately. Restore the authored duration before detecting
      // the next close animation type, otherwise that first close is misread as
      // "no motion" and the close transition or keyframe gets skipped.
      if (!isOpen && pendingTemporaryStyleRestoreRef) {
        restorePendingTemporaryStyle();
      }

      const animationType = getAnimationType(panel, preventOpenAnimation);
      animationTypeRef = animationType;

      // Initially open keyframe panels skip their first paint animation to avoid
      // layout shift, but we still need to cache the expanded size so the first
      // close animation can start from pixels instead of `auto`.
      if (
        isOpen &&
        status === 'idle' &&
        shouldPreventMountAnimationRef &&
        animationType === 'css-animation'
      ) {
        lastMeasuredDimensionsRef = getDimensions(panel);
        return undefined;
      }

      // Handle the opening pass: measure the expanded size and, when necessary,
      // neutralize author-defined motion so the panel can open immediately.
      if (isOpen && status === 'starting') {
        // `beforematch` opens should reveal the panel immediately so find-in-page
        // does not wait for the author-defined transition or animation to finish.
        const skipNextOpen = shouldSkipNextOpenRef;
        shouldSkipNextOpenRef = false;

        if (animationType === 'none') {
          setDimensions(getDimensions(panel));
          setForcePanelIdle(true);
          return undefined;
        }

        if (animationType === 'css-transition') {
          const restoreLayoutStyles = resetLayoutStyles(panel);
          setDimensions(getDimensions(panel));

          if (!skipNextOpen) {
            return restoreLayoutStyles;
          }

          const restoreTransitionDuration = setTemporaryStyle(panel, 'transition-duration', '0s');
          setPendingTemporaryStyleRestore(restoreTransitionDuration);
          setForcePanelIdle(true);
          return restoreLayoutStyles;
        }

        setDimensions(getDimensions(panel));

        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        if (!skipNextOpen) {
          restoreAnimationName();
          return undefined;
        }

        const restoreAnimationDuration = setTemporaryStyle(panel, 'animation-duration', '0s');

        restoreAnimationName();
        setPendingTemporaryStyleRestore(restoreAnimationDuration);
        setForcePanelIdle(true);

        return undefined;
      }

      // Capture the current size as soon as close is requested, before the
      // deferred ending phase applies closed styles. This keeps close transitions
      // starting from a measured pixel value, including interrupted opens.
      if (!isOpen && isMounted && (status === 'idle' || status === 'starting')) {
        shouldPreventMountAnimationRef = false;

        if (animationType === 'none') {
          setDimensions(EMPTY_DIMENSIONS, false);
          setMounted(false);
          return undefined;
        }

        setDimensions(getDimensions(panel));
        // Solid: the deferred `ending` frame applies its update before the browser's next style
        // recalc (React commits a rAF update after paint), so flush the style once this flush has
        // rendered the measured size; otherwise the close transition starts from `auto`.
        queueMicrotask(() => flushStyle(panel));
        return undefined;
      }

      if (status !== 'ending') {
        return undefined;
      }

      // Reachable when `transitionStatus` already flipped to `ending` before this effect ran, so
      // the close branch above was skipped. Without motion there is nothing to wait for, so unmount
      // here instead of deferring to the animation-finished path below.
      if (animationType === 'none') {
        setMounted(false);
        return undefined;
      }

      const nextDimensions = getDimensions(panel);
      const hasMeasuredSize = nextDimensions.height > 0 || nextDimensions.width > 0;

      if (!hasMeasuredSize) {
        setMounted(false);
        return undefined;
      }

      setDimensions(nextDimensions);

      if (animationType === 'css-animation') {
        const restoreAnimationName = setTemporaryStyle(panel, 'animation-name', 'none');
        restoreAnimationName();
      }

      return undefined;
    },
  );

  useOpenChangeComplete({
    enabled: () => open() && mounted() && panelTransitionStatus() === 'idle',
    open: true,
    ref: panelElement,
    onComplete() {
      // `useOpenChangeComplete` only aborts from its effect cleanup, which can run after an
      // animation's `finished` microtask resolves for a render that already set `open` to
      // `false`, so re-check the latest value here. Clearing the measured size in that window
      // would make the close transition start from `height: 0` instead of the expanded pixel
      // height.
      if (!untrack(open)) {
        return;
      }

      setDimensions(EMPTY_DIMENSIONS, false);
    },
  });

  // Closing panels need extra sequencing beyond `useOpenChangeComplete`.
  // This passive effect runs after the `ending` render has committed, so
  // `[data-ending-style]` is already present. Chrome can still register the
  // exit transition one frame later when an Accordion closes one item while
  // opening another, so wait one frame before watching animations.
  // See https://github.com/mui/base-ui/issues/3099
  createEffect(
    () => ({
      panel: panelElement(),
      open: open(),
      mounted: mounted(),
      panelTransitionStatus: panelTransitionStatus(),
    }),
    (deps) => {
      if (deps.open || !deps.mounted || deps.panelTransitionStatus !== 'ending') {
        return undefined;
      }

      if (!deps.panel) {
        return undefined;
      }

      const abortController = new AbortController();
      let endingStyleFrame = -1;

      function handleComplete() {
        // Same race as the `useOpenChangeComplete` callback above: read the latest value, since
        // unmounting a panel that has already reopened would drop it from the DOM.
        if (untrack(open)) {
          return;
        }

        setMounted(false);
        setDimensions(EMPTY_DIMENSIONS, false);
      }

      endingStyleFrame = AnimationFrame.request(() => {
        runOnceCloseAnimationsFinish(handleComplete, abortController.signal);
      });

      return () => {
        AnimationFrame.cancel(endingStyleFrame);
        abortController.abort();
      };
    },
  );

  // Solid: string `hidden` values render as-is, so `hidden="until-found"` is set through the
  // `hidden` prop below instead of being forced back into the DOM from a layout effect.

  createEffect(panelElement, function registerBeforeMatchListener(panel) {
    if (!panel) {
      return undefined;
    }

    function handleBeforeMatch(event: Event) {
      const eventDetails = createChangeEventDetails(REASONS.none, event);

      onOpenChange(true, eventDetails);

      if (eventDetails.isCanceled) {
        return;
      }

      shouldSkipNextOpenRef = true;
      setOpen(true);
    }

    return addEventListener(panel, 'beforematch', handleBeforeMatch);
  });

  const shouldRender = createMemo(() => keepMounted() || hiddenUntilFound() || mounted() || open());

  // Solid: a memo so the starting-style key is omitted rather than set to `undefined`, which
  // would override the transition status attribute in the merged props.
  const props = createMemo<HTMLProps>(() => ({
    ...(shouldPersistHiddenTransitionStyles()
      ? { [CollapsiblePanelDataAttributes.startingStyle]: '' }
      : undefined),
    hidden: hidden() ? (hiddenUntilFound() ? 'until-found' : true) : undefined,
    id: idParam(),
  }));

  return {
    props,
    ref: setPanelElement,
    shouldPreventOpenAnimation,
    shouldRender,
    transitionStatus: panelTransitionStatus,
  };
}

function flushStyle(element: HTMLElement) {
  // Reading a computed value makes the current inline styles the transition's start values.
  void ownerWindow(element).getComputedStyle(element).height;
}

function getDimensions(element: HTMLElement) {
  return {
    height: element.scrollHeight,
    width: element.scrollWidth,
  };
}

function getAnimationType(
  element: HTMLElement,
  hasSuppressedMountAnimation: boolean,
): AnimationType {
  const panelStyles = ownerWindow(element).getComputedStyle(element);
  const hasAnimation =
    (panelStyles.animationName
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && name !== 'none') ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(panelStyles.animationDuration);
  const hasTransition = hasNonZeroDuration(panelStyles.transitionDuration);

  if (hasAnimation && hasTransition) {
    if (process.env.NODE_ENV !== 'production') {
      warn(
        'CSS transitions and CSS animations both detected on Collapsible or Accordion panel.',
        'Only one of either animation type should be used.',
      );
    }

    return 'css-transition';
  }

  if (hasTransition) {
    return 'css-transition';
  }

  if (hasAnimation) {
    return 'css-animation';
  }

  return 'none';
}

function hasNonZeroDuration(value: string) {
  return value
    .split(',')
    .map((part) => part.trim())
    .some((part) => part !== '' && Number.parseFloat(part) > 0);
}

/**
 * Temporarily overrides an inline style property and returns a cleanup that
 * restores the previous inline value and priority.
 * @param element - The element whose inline style should be updated.
 * @param property - The CSS property name to override.
 * @param value - The temporary value to assign.
 * @returns A cleanup function that restores the original inline style state.
 */
function setTemporaryStyle(element: HTMLElement, property: string, value: string): () => void {
  const previousValue = element.style.getPropertyValue(property);
  const previousPriority = element.style.getPropertyPriority(property);

  element.style.setProperty(property, value);

  return () => {
    if (previousValue === '') {
      element.style.removeProperty(property);
      return;
    }

    element.style.setProperty(property, previousValue, previousPriority);
  };
}

/**
 * Temporarily resets inline alignment styles that can distort scroll-based
 * size measurements, then restores them on the next animation frame.
 * @param element - The panel element being measured.
 * @returns A cleanup function that cancels the scheduled restore and reapplies
 * the original inline layout styles immediately.
 */
function resetLayoutStyles(element: HTMLElement): () => void {
  const originalLayoutStyles = {
    'justify-content': element.style.justifyContent,
    'align-items': element.style.alignItems,
    'align-content': element.style.alignContent,
    'justify-items': element.style.justifyItems,
  };

  Object.keys(originalLayoutStyles).forEach((key) => {
    element.style.setProperty(key, 'initial', 'important');
  });

  function restoreLayoutStyles() {
    Object.entries(originalLayoutStyles).forEach(([key, value]) => {
      if (value === '') {
        element.style.removeProperty(key);
        return;
      }

      element.style.setProperty(key, value);
    });
  }

  const frame = AnimationFrame.request(restoreLayoutStyles);

  return () => {
    AnimationFrame.cancel(frame);
    restoreLayoutStyles();
  };
}

export interface UseCollapsiblePanelParameters {
  /**
   * Allows the browser's built-in page search to find and expand the panel contents.
   *
   * Overrides the `keepMounted` prop and uses `hidden="until-found"`
   * to hide the element without removing it from the DOM.
   */
  hiddenUntilFound: MaybeAccessor<boolean>;
  /**
   * The `id` attribute of the panel.
   */
  id: MaybeAccessor<JSX.HTMLAttributes<Element>['id']>;
  /**
   * Whether to keep the element in the DOM while the panel is closed.
   * This prop is ignored when `hiddenUntilFound` is used.
   */
  keepMounted: MaybeAccessor<boolean>;
  /**
   * Whether the collapsible panel is mounted for transition and hidden-state
   * purposes. This can be `false` while the element remains in the DOM when
   * `keepMounted` or `hiddenUntilFound` is enabled.
   */
  mounted: MaybeAccessor<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: MaybeAccessor<boolean>;
  setMounted: (nextMounted: boolean) => void;
  /** The CSS variables the panel's measured height and width are written to. */
  dimensionCssVars: { height: string; width: string };
  setOpen: (nextOpen: boolean) => void;
  transitionStatus: MaybeAccessor<TransitionStatus>;
}

export interface UseCollapsiblePanelReturnValue {
  props: Accessor<HTMLProps>;
  // Solid: the caller merges this with the user's ref through `useRenderElement`.
  ref: (element: HTMLDivElement | null) => void;
  shouldPreventOpenAnimation: Accessor<boolean>;
  shouldRender: Accessor<boolean>;
  transitionStatus: Accessor<TransitionStatus>;
}

export namespace useCollapsiblePanel {
  export type Parameters = UseCollapsiblePanelParameters;
  export type ReturnValue = UseCollapsiblePanelReturnValue;
}
