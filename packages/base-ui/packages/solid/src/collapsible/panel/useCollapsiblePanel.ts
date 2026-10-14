import {
  createMemo,
  createSignal,
  getOwner,
  onCleanup,
  onSettled,
  runWithOwner,
  untrack,
} from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { access } from '../../solid-helpers';
import type { MaybeAccessor } from '../../solid-helpers';
import { createEffectGroup } from '../../utils/native/effectGroup';
import { addEventListener } from '../../utils/addEventListener';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { ownerWindow } from '../../utils/owner';
import { REASONS } from '../../utils/reasons';
import type { HTMLProps } from '../../utils/types';
import { AnimationFrame } from '../../utils/useAnimationFrame';
import { useTimeout } from '../../utils/useTimeout';
import { useAnimationsFinished } from '../../utils/useAnimationsFinished';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { warn } from '../../utils/warn';
import type { CollapsibleRoot } from '../root/CollapsibleRoot';
import * as CollapsiblePanelDataAttributes from './CollapsiblePanelDataAttributes';
import { runInLazyScope } from '../../utils/runInLazyScope';

type AnimationType = 'css-transition' | 'css-animation' | 'none';

interface Dimensions {
  height: number | undefined;
  width: number | undefined;
}

const EMPTY_DIMENSIONS: Dimensions = {
  height: undefined,
  width: undefined,
};

// Measured sizes are written to the panels' CSS variables once the current flush has settled, after
// every panel's effect has measured: a write between two panels' measurements would force a layout
// per panel (React applies its `setDimensions` state after all layout effects, so it lays out once).
// The one-shot runs inside the flush (tests reading the variables after `flush()` see them) and
// before microtasks (the close path's `flushStyle`).
let pendingDimensionWrites: Array<() => void> | null = null;

function scheduleDimensionWrite(write: () => void) {
  if (pendingDimensionWrites === null) {
    const writes: Array<() => void> = [];
    pendingDimensionWrites = writes;
    runWithOwner(null, () =>
      onSettled(() => {
        pendingDimensionWrites = null;
        for (const pending of writes) {
          pending();
        }
      }),
    );
  }
  pendingDimensionWrites.push(write);
}
const EMPTY_PROPS: Accessor<HTMLProps> = () => ({});

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
  const native = parameters.native === true;
  const owner = getOwner();

  // Solid: the panel element is a signal so effects run once it is attached, as React's
  // effects run after commit with the ref already set. A native panel attaches its element
  // synchronously while it renders, before any effect created in that render runs, and every
  // later change of the element comes with an `open`/status change the effects follow, so a
  // plain box stands in for the signal there (the ref re-applies the dimensions itself).
  const [panelElement, setPanelElement] = native
    ? createBox<HTMLDivElement | null>(null)
    : createSignal<HTMLDivElement | null>(null, { ownedWrite: true });
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
  // Solid: a native panel creates this hook when it first renders, so it passes the `open` the
  // panel had when it was created.
  let shouldPreventMountAnimationRef = parameters.initialOpen ?? untrack(open);
  // Solid: there is no React.Activity, so effects are never torn down while state is kept and
  // React's activity-resume suppression has nothing to guard.
  // Some open paths intentionally bypass motion, but the shared root transition
  // status still advances asynchronously. Override the panel to idle so its data
  // attributes and dimension cleanup reflect the immediate open state.
  // A plain signal: an open path that skips motion sets it from the measuring effect, and that
  // effect clears it as soon as it sees the shared root transition leave `starting` (it runs on
  // every status change, always before the next `starting`, which needs an open flip), so the
  // override never outlives that frame.
  const [forcePanelIdle, setForcePanelIdle] = createSignal(false);
  let pendingTemporaryStyleRestoreRef: (() => void) | null = null;

  // The animations-finished watchers are created on their first use (a panel that only opens
  // never needs the close watcher), owned by the hook's owner.
  let runOnceOpenAnimationsFinish: ReturnType<typeof useAnimationsFinished> | undefined;
  let runOnceCloseAnimationsFinish: ReturnType<typeof useAnimationsFinished> | undefined;

  // Plain derivations (no memo per panel): each is a cheap boolean/string read, and the effects
  // below compare their dependency snapshots themselves.
  const hidden = () => !open() && !mounted();
  const panelTransitionStatus = () => {
    const status = transitionStatus();
    return status === 'starting' && forcePanelIdle() ? 'idle' : status;
  };
  const shouldPreventOpenAnimation = () =>
    open() &&
    // Safe to read here: it only changes from committed layout paths while closed, and readers
    // re-read it when `open` flips back.
    shouldPreventMountAnimationRef;
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

  let dimensionWriteScheduled = false;
  function writeDimensions() {
    dimensionWriteScheduled = false;
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

  // One write per panel per flush, with the sizes current when the flush settles.
  function applyDimensions() {
    if (dimensionWriteScheduled) {
      return;
    }
    dimensionWriteScheduled = true;
    scheduleDimensionWrite(writeDimensions);
  }

  const shouldPersistHiddenTransitionStyles = () =>
    hiddenUntilFound() && hidden() && animationTypeRef !== 'css-animation';

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

  void onCleanup(() => {
    restorePendingTemporaryStyle();
  });

  // The three passive effects of the React panel (measure, open complete, close) share one
  // reactive node; each keeps its own dependencies, apply condition and cleanup.
  createEffectGroup([
    {
      // Re-apply the rendered size when its inputs change: `open` directly, `mounted` through the
      // open or status change that always comes with it (the layout effect React runs for it).
      // The element is read when the part applies (React's `ref.current`): its dependency value
      // is computed when the node is created, before a native panel's ref has attached.
      deps: () =>
        [panelElement(), open(), shouldPreventOpenAnimation(), transitionStatus()] as const,
      // Solid: a user effect, so it runs after the panel's DOM (including a render prop's output)
      // has updated, as React's layout effect runs after commit.
      apply([, isOpen, preventOpenAnimation, status]) {
        const panel = untrack(panelElement);
        applyDimensions();
        if (status !== 'starting' && untrack(forcePanelIdle)) {
          setForcePanelIdle(false);
        }
        // Not a dependency: open and status changes drive this pass, and it unmounts the panel
        // itself when there is nothing to animate.
        const isMounted = untrack(mounted);
        // A render function can remove the panel on close. Clear one-shot open animation
        // suppression even without an element, so the next open animates normally.
        if (!isOpen) {
          shouldPreventMountAnimationRef = false;
        }
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
    },
    {
      // `useOpenChangeComplete({ enabled: open && mounted && idle, open: true, ref: panel })`,
      // inlined: it waits for `[data-starting-style]` to be removed, then for the open
      // animations, and clears the measured size.
      deps: () => [open(), open() && mounted() && panelTransitionStatus() === 'idle'] as const,
      apply([, enabled]) {
        if (!enabled) {
          return undefined;
        }
        runOnceOpenAnimationsFinish ??= runInLazyScope(owner, () =>
          useAnimationsFinished(panelElement, true),
        )!;
        const onComplete = () => {
          // `useOpenChangeComplete` only aborts from its effect cleanup, which can run after an
          // animation's `finished` microtask resolves for a render that already set `open` to
          // `false`, so re-check the latest value here. Clearing the measured size in that window
          // would make the close transition start from `height: 0` instead of the expanded pixel
          // height.
          if (!untrack(open)) {
            return;
          }

          setDimensions(EMPTY_DIMENSIONS, false);
        };
        // Without an element there is nothing to wait for or abort (a part that is not rendered).
        // The watcher reads the element accessor: untracked, as an effect callback's reads are.
        return untrack(() => {
          if (panelElement() == null) {
            runOnceOpenAnimationsFinish!(onComplete);
            return undefined;
          }

          const abortController = new AbortController();
          runOnceOpenAnimationsFinish!(onComplete, abortController.signal);

          return () => abortController.abort();
        });
      },
    },
    {
      // Closing panels need extra sequencing beyond `useOpenChangeComplete`.
      // This passive effect runs after the `ending` render has committed, so
      // `[data-ending-style]` is already present. Chrome can still register the
      // exit transition one frame later when an Accordion closes one item while
      // opening another, so wait one frame before watching animations.
      // See https://github.com/mui/base-ui/issues/3099
      deps: () => [panelElement(), open(), mounted(), panelTransitionStatus()] as const,
      apply([, isOpen, isMounted, status]) {
        if (isOpen || !isMounted || status !== 'ending') {
          return undefined;
        }

        const panel = untrack(panelElement);
        // Solid: a render function that returns null does not clear the ref, so a detached
        // element is the cleared ref React would see. A missing element is the same case.
        if (panel?.isConnected !== true) {
          // A render function can drop the panel element while it closes. There is nothing left
          // to animate, so finish closing instead of staying in the ending phase.
          setMounted(false);
          setDimensions(EMPTY_DIMENSIONS, false);
          return undefined;
        }

        runOnceCloseAnimationsFinish ??= runInLazyScope(owner, () =>
          useAnimationsFinished(panelElement),
        )!;
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
          runOnceCloseAnimationsFinish!(handleComplete, abortController.signal);
        });

        return () => {
          AnimationFrame.cancel(endingStyleFrame);
          abortController.abort();
        };
      },
    },
  ]);

  // Solid: string `hidden` values render as-is, so `hidden="until-found"` is set through the
  // `hidden` prop below instead of being forced back into the DOM from a layout effect.

  // Decides, after the browser has measured the match, whether a `beforematch` open actually
  // landed. A task (not a frame) runs after Solid's microtask flush, so a real open is visible
  // here and an ignored one is not. The DOM revert then runs in a frame so it stays atomic
  // with respect to paint.
  const revealDecisionTimeout = useTimeout();
  let revertRevealFrame = -1;
  void onCleanup(() => {
    AnimationFrame.cancel(revertRevealFrame);
  });

  // The `beforematch` listener follows the element from the ref (no effect): attached with the
  // element, removed when the ref clears it. An attached element gets the current rendered size
  // written in this flush (React's layout effect on the element ref).
  let removeBeforeMatchListener: (() => void) | undefined;
  const ref = (element: HTMLDivElement | null) => {
    removeBeforeMatchListener?.();
    revealDecisionTimeout.clear();
    AnimationFrame.cancel(revertRevealFrame);
    revertRevealFrame = -1;

    if (!element) {
      removeBeforeMatchListener = undefined;
      setPanelElement(element);
      return;
    }

    const scheduleRevealRevert = (revertSkippedMotion: boolean, restoreStartingStyle: boolean) => {
      revealDecisionTimeout.start(0, () => {
        if (untrack(open)) {
          return;
        }

        revertRevealFrame = AnimationFrame.request(() => {
          if (untrack(open)) {
            return;
          }

          if (revertSkippedMotion) {
            // The open never happened, so the next one is an ordinary open that
            // should keep its author-defined motion.
            shouldSkipNextOpenRef = false;
          }

          if (restoreStartingStyle) {
            element.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
          }

          element.setAttribute('hidden', 'until-found');
        });
      });
    };

    // Declared here so the handler touches the same element the listener is attached to.
    const handleBeforeMatch = (event: Event) => {
      const eventDetails = createChangeEventDetails(REASONS.none, event);

      onOpenChange(true, eventDetails);

      if (eventDetails.isCanceled) {
        // A canceled reveal means the panel must stay hidden, so undo the
        // browser's removal of `hidden` and keep the content searchable.
        scheduleRevealRevert(false, false);
        return;
      }

      shouldSkipNextOpenRef = true;

      // The browser removes `hidden` and measures the match in the same task that
      // dispatches this event, while the state update below only lands in a later
      // one. Panels kept collapsed by persisted starting styles would still be
      // zero-sized at that point and the match highlight is dropped, so drop those
      // styles synchronously here.
      const hadStartingStyle = element.hasAttribute(CollapsiblePanelDataAttributes.startingStyle);
      element.removeAttribute(CollapsiblePanelDataAttributes.startingStyle);

      setOpen(true);

      // A controlled panel whose `onOpenChange` is ignored never receives the open
      // state, so return it to the fully closed state once the browser has measured.
      scheduleRevealRevert(true, hadStartingStyle);
    };

    removeBeforeMatchListener = addEventListener(element, 'beforematch', handleBeforeMatch);
    setPanelElement(element);
    applyDimensions();
  };

  // `<Show>` memoizes its condition, so a plain function costs nothing more.
  const shouldRender = () => keepMounted() || hiddenUntilFound() || mounted() || open();

  const hiddenAttribute = () => {
    if (!hidden()) {
      return undefined;
    }
    return hiddenUntilFound() ? 'until-found' : true;
  };

  // Solid: a memo so the starting-style key is omitted rather than set to `undefined`, which
  // would override the transition status attribute in the merged props. A native panel writes
  // the attributes itself and needs no memo.
  const props = native
    ? EMPTY_PROPS
    : createMemo<HTMLProps>(() => ({
        ...(shouldPersistHiddenTransitionStyles()
          ? { [CollapsiblePanelDataAttributes.startingStyle]: '' }
          : undefined),
        hidden: hiddenAttribute(),
        id: idParam(),
      }));

  return {
    hiddenAttribute,
    props,
    ref,
    shouldPersistHiddenTransitionStyles,
    shouldPreventOpenAnimation,
    shouldRender,
    transitionStatus: panelTransitionStatus,
  };
}

/** A plain value box with a signal's `[read, write]` shape (no reactive node). */
function createBox<T>(initial: T): [() => T, (value: T) => void] {
  let value = initial;
  return [
    () => value,
    (next: T) => {
      value = next;
    },
  ];
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
  const animationDuration = panelStyles.animationDuration;
  const transitionDuration = panelStyles.transitionDuration;
  // The common case (no motion authored): both durations are the single `0s`, so neither an
  // animation nor a transition can be detected below.
  if (animationDuration === '0s' && transitionDuration === '0s') {
    return 'none';
  }
  const hasAnimation =
    (panelStyles.animationName
      .split(',')
      .map((name) => name.trim())
      .some((name) => name !== '' && name !== 'none') ||
      hasSuppressedMountAnimation) &&
    hasNonZeroDuration(animationDuration);
  const hasTransition = hasNonZeroDuration(transitionDuration);

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
  /**
   * Solid: the `open` value the panel was created with, for a hook created later (a native panel
   * creates it when it first renders).
   */
  initialOpen?: boolean | undefined;
  /** Solid: the caller writes the attributes itself from `hiddenAttribute` and the status accessors. */
  native?: boolean | undefined;
}

export interface UseCollapsiblePanelReturnValue {
  /** The `hidden` attribute: `'until-found'`, `true` or absent. */
  hiddenAttribute: Accessor<'until-found' | true | undefined>;
  props: Accessor<HTMLProps>;
  /** Whether `[data-starting-style]` is kept on a hidden-until-found panel. */
  shouldPersistHiddenTransitionStyles: Accessor<boolean>;
  // Solid: the caller merges this with the user's ref through `useRenderElement`.
  ref: (element: HTMLDivElement | null) => void;
  shouldPreventOpenAnimation: Accessor<boolean>;
  shouldRender: () => boolean;
  transitionStatus: Accessor<TransitionStatus>;
}

export namespace useCollapsiblePanel {
  export type Parameters = UseCollapsiblePanelParameters;
  export type ReturnValue = UseCollapsiblePanelReturnValue;
}
