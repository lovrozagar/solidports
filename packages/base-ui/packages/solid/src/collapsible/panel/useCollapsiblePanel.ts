import { createTrackedEffect, createEffect, createMemo, onCleanup, onSettled } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { AccordionRootDataAttributes } from '../../accordion/root/AccordionRootDataAttributes';
import { access, type MaybeAccessor, type ReactLikeRef } from '../../solid-helpers';
import { createChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { REASONS } from '../../utils/reasons';
import { HTMLProps } from '../../utils/types';
import { AnimationFrame, useAnimationFrame } from '../../utils/useAnimationFrame';
import { warn } from '../../utils/warn';
import type { CollapsibleRoot } from '../root/CollapsibleRoot';
import type { AnimationType, Dimensions } from '../root/useCollapsibleRoot';
import { CollapsiblePanelDataAttributes } from './CollapsiblePanelDataAttributes';
import { on } from '../../solid-1-compat';

export function useCollapsiblePanel(
  parameters: useCollapsiblePanel.Parameters,
): useCollapsiblePanel.ReturnValue {
  const height = () => access(parameters.height);
  const hiddenUntilFound = () => access(parameters.hiddenUntilFound);
  const id = () => access(parameters.id);
  const keepMounted = () => access(parameters.keepMounted);
  const mounted = () => access(parameters.mounted);
  const open = () => access(parameters.open);
  const visible = () => access(parameters.visible);
  const width = () => access(parameters.width);

  let isBeforeMatchRef = false;
  let latestAnimationNameRef = null as string | null;
  let shouldCancelInitialOpenAnimationRef = open();
  let shouldCancelInitialOpenTransitionRef = open();

  const endingStyleFrame = useAnimationFrame();

  /**
   * When opening, the `hidden` attribute is removed immediately.
   * When closing, the `hidden` attribute is set after any exit animations runs.
   */
  const hidden = createMemo(() => {
    if (parameters.animationTypeRef.current === 'css-animation') {
      return !visible();
    }

    return !open() && !mounted();
  });

  /**
   * Reads the panel's computed styles once to pick the animation strategy. Solid 2 applies
   * refs before the element is attached, so the open effect also calls this once the panel is
   * in the document instead of waiting for the deferred ref callback.
   */
  function detectAnimationType(element: HTMLElement) {
    if (
      parameters.animationTypeRef.current != null &&
      parameters.transitionDimensionRef.current != null
    ) {
      return;
    }
    {
      const panelStyles = getComputedStyle(element);

      const hasAnimation = panelStyles.animationName !== 'none' && panelStyles.animationName !== '';
      const hasTransition =
        panelStyles.transitionDuration !== '0s' && panelStyles.transitionDuration !== '';

      /**
       * animationType is safe to read in render because it's only ever set
       * once here during the first render and never again.
       * https://react.dev/learn/referencing-values-with-refs#best-practices-for-refs
       */
      if (hasAnimation && hasTransition) {
        if (process.env.NODE_ENV !== 'production') {
          warn(
            'CSS transitions and CSS animations both detected on Collapsible or Accordion panel.',
            'Only one of either animation type should be used.',
          );
        }
      } else if (panelStyles.animationName === 'none' && panelStyles.transitionDuration !== '0s') {
        parameters.animationTypeRef.current = 'css-transition';
      } else if (panelStyles.animationName !== 'none' && panelStyles.transitionDuration === '0s') {
        parameters.animationTypeRef.current = 'css-animation';
      } else {
        parameters.animationTypeRef.current = 'none';
      }

      /**
       * We need to know in advance which side is being collapsed when using CSS
       * transitions in order to set the value of width/height to `0px` momentarily.
       * Setting both to `0px` will break layout.
       */
      if (
        element.getAttribute(AccordionRootDataAttributes.orientation) === 'horizontal' ||
        panelStyles.transitionProperty.indexOf('width') > -1
      ) {
        parameters.transitionDimensionRef.current = 'width';
      } else {
        parameters.transitionDimensionRef.current = 'height';
      }
    }
  }

  /* Refs run without an owner in Solid 2, so the ref callback's frames are cancelled here. */
  let refFrame = -1;
  let refNextFrame = -1;
  onCleanup(() => {
    AnimationFrame.cancel(refFrame);
    AnimationFrame.cancel(refNextFrame);
  });

  /**
   * When `keepMounted` is `true` this runs once as soon as it exists in the DOM
   * regardless of initial open state.
   *
   * When `keepMounted` is `false` this runs on every mount, typically every
   * time it opens. If the panel is in the middle of a close transition that is
   * interrupted and re-opens, this won't run as the panel was not unmounted.
   */
  function handlePanelRef(element: HTMLElement | null | undefined) {
    if (!element) {
      return;
    }
    /* Solid native-element refs can fire while the element is parented but before its parent is attached to the document — getComputedStyle returns empty strings until then.
       Defer to a microtask so the connection completes before measuring. */
    if (!element.isConnected) {
      queueMicrotask(() => handlePanelRef(element));
      return;
    }
    detectAnimationType(element);

    if (parameters.animationTypeRef.current !== 'css-transition') {
      return;
    }

    if (height() === undefined || width() === undefined) {
      /* Neutralize flex/grid layout + override height/width so scrollHeight/Width measure natural content — without this, a flex panel with `height:0` from `[data-starting-style]` reports scrollHeight=0 and the open transition has no target dimension. */
      const originalInline = {
        'align-content': element.style.alignContent,
        'align-items': element.style.alignItems,
        height: element.style.height,
        'justify-content': element.style.justifyContent,
        'justify-items': element.style.justifyItems,
        width: element.style.width,
      };
      Object.keys(originalInline).slice(0, 4).forEach((key) => {
        element.style.setProperty(key, 'initial', 'important');
      });
      element.style.setProperty('height', 'auto', 'important');
      element.style.setProperty('width', 'auto', 'important');

      parameters.setDimensions({ height: element.scrollHeight, width: element.scrollWidth });

      Object.entries(originalInline).forEach(([key, value]) => {
        if (value === '') {
          element.style.removeProperty(key);
        } else {
          element.style.setProperty(key, value);
        }
      });

      if (shouldCancelInitialOpenTransitionRef) {
        element.style.setProperty('transition-duration', '0s');
      }
    }

    AnimationFrame.cancel(refFrame);
    AnimationFrame.cancel(refNextFrame);
    refFrame = AnimationFrame.request(() => {
      shouldCancelInitialOpenTransitionRef = false;
      refNextFrame = AnimationFrame.request(() => {
        /**
         * This is slightly faster than another RAF and is the earliest
         * opportunity to remove the temporary `transition-duration: 0s` that
         * was applied to cancel opening transitions of initially open panels.
         * https://nolanlawson.com/2018/09/25/accurately-measuring-layout-on-the-web/
         */
        setTimeout(() => {
          element.style.removeProperty('transition-duration');
        });
      });
    });
  }

  createEffect(...on([hiddenUntilFound, keepMounted, mounted, open], () => {
      const panel = parameters.panelRef.current;

      if (!panel) {
        return;
      }

      if (panel.isConnected) {
        detectAnimationType(panel);
      }

      if (parameters.animationTypeRef.current !== 'css-transition') {
        return;
      }

      let resizeFrame = -1;

      if (parameters.abortControllerRef.current != null) {
        parameters.abortControllerRef.current.abort();
        parameters.abortControllerRef.current = null;
      }

      if (open()) {
        const originalLayoutStyles = {
          'align-content': panel.style.alignContent,
          'align-items': panel.style.alignItems,
          'justify-content': panel.style.justifyContent,
          'justify-items': panel.style.justifyItems,
        };
        /* opening */
        Object.keys(originalLayoutStyles).forEach((key) => {
          panel.style.setProperty(key, 'initial', 'important');
        });

        /**
         * When `keepMounted={false}` and the panel is initially closed, the very
         * first time it opens (not any subsequent opens) `data-starting-style` is
         * off or missing by a frame so we need to set it manually. Otherwise any
         * CSS properties expected to transition using [data-starting-style] may
         * be mis-timed and appear to be complete skipped.
         */
        if (!shouldCancelInitialOpenTransitionRef && !keepMounted()) {
          panel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
        }

        parameters.setDimensions({ height: panel.scrollHeight, width: panel.scrollWidth });

        resizeFrame = AnimationFrame.request(() => {
          Object.entries(originalLayoutStyles).forEach(([key, value]) => {
            if (value === '') {
              panel.style.removeProperty(key);
            } else {
              panel.style.setProperty(key, value);
            }
          });
        });
      } else {
        if (panel.scrollHeight === 0 && panel.scrollWidth === 0) {
          return;
        }

        /* closing */
        parameters.setDimensions({ height: panel.scrollHeight, width: panel.scrollWidth });

        const abortController = new AbortController();
        parameters.abortControllerRef.current = abortController;
        const signal = abortController.signal;

        let attributeObserver: MutationObserver | null = null;

        const endingStyleAttribute = CollapsiblePanelDataAttributes.endingStyle;

        // Wait for `[data-ending-style]` to be applied.
        attributeObserver = new MutationObserver((mutationList) => {
          const hasEndingStyle = mutationList.some(
            (mutation) =>
              mutation.type === 'attributes' && mutation.attributeName === endingStyleAttribute,
          );

          if (hasEndingStyle) {
            attributeObserver?.disconnect();
            attributeObserver = null;
            parameters.runOnceAnimationsFinish(() => {
              parameters.setDimensions({ height: 0, width: 0 });
              panel.style.removeProperty('content-visibility');
              parameters.setMounted(false);
              if (parameters.abortControllerRef.current === abortController) {
                parameters.abortControllerRef.current = null;
              }
            }, signal);
          }
        });

        attributeObserver.observe(panel, {
          attributeFilter: [endingStyleAttribute],
          attributes: true,
        });

        return () => {
          attributeObserver?.disconnect();
          endingStyleFrame.cancel();
          if (parameters.abortControllerRef.current === abortController) {
            abortController.abort();
            parameters.abortControllerRef.current = null;
          }
        };
      }

      return () => AnimationFrame.cancel(resizeFrame);
    }),
  );

  createTrackedEffect(() => {
    if (parameters.animationTypeRef.current !== 'css-animation') {
      return;
    }

    const panel = parameters.panelRef.current;
    if (!panel) {
      return;
    }

    latestAnimationNameRef = panel.style.animationName || latestAnimationNameRef;

    panel.style.setProperty('animation-name', 'none');

    parameters.setDimensions({ height: panel.scrollHeight, width: panel.scrollWidth });

    if (!shouldCancelInitialOpenAnimationRef && !isBeforeMatchRef) {
      panel.style.removeProperty('animation-name');
    }

    if (open()) {
      if (parameters.abortControllerRef.current != null) {
        parameters.abortControllerRef.current.abort();
        parameters.abortControllerRef.current = null;
      }
      parameters.setMounted(true);
      parameters.setVisible(true);
    } else {
      parameters.abortControllerRef.current = new AbortController();
      parameters.runOnceAnimationsFinish(() => {
        parameters.setMounted(false);
        parameters.setVisible(false);
        parameters.abortControllerRef.current = null;
      }, parameters.abortControllerRef.current.signal);
    }
  });

  onSettled(() => {
    const _c: Array<() => void> = [];
    (() => {

    const frame = AnimationFrame.request(() => {
      shouldCancelInitialOpenAnimationRef = false;
    });
    _c.push(() => AnimationFrame.cancel(frame));
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

    if (!hiddenUntilFound()) {
      return;
    }

    const panel = parameters.panelRef.current;
    if (!panel) {
      return;
    }

    let frame = -1;
    let nextFrame = -1;

    if (open() && isBeforeMatchRef) {
      panel.style.transitionDuration = '0s';
      parameters.setDimensions({ height: panel.scrollHeight, width: panel.scrollWidth });
      frame = AnimationFrame.request(() => {
        isBeforeMatchRef = false;
        nextFrame = AnimationFrame.request(() => {
          setTimeout(() => {
            panel.style.removeProperty('transition-duration');
          });
        });
      });
    }

    _c.push(() => {
      AnimationFrame.cancel(frame);
      AnimationFrame.cancel(nextFrame);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  createTrackedEffect(() => {
    const panel = parameters.panelRef.current;

    if (panel && hiddenUntilFound() && hidden()) {
      /**
       * React only supports a boolean for the `hidden` attribute and forces
       * legit string values to booleans so we have to force it back in the DOM
       * when necessary: https://github.com/facebook/react/issues/24740
       */
      panel.setAttribute('hidden', 'until-found');
      /**
       * Set data-starting-style here to persist the closed styles, this is to
       * prevent transitions from starting when the `hidden` attribute changes
       * to `'until-found'` as they could have different `display` properties:
       * https://github.com/tailwindlabs/tailwindcss/pull/14625
       */
      if (parameters.animationTypeRef.current === 'css-transition') {
        panel.setAttribute(CollapsiblePanelDataAttributes.startingStyle, '');
      }
    }
  });

  createTrackedEffect(function registerBeforeMatchListener() {
    const _c: Array<() => void> = [];
    (() => {

    const panel = parameters.panelRef.current;
    if (!panel) {
      return;
    }

    function handleBeforeMatch(event: Event) {
      isBeforeMatchRef = true;
      parameters.setOpen(true);
      parameters.onOpenChange(true, createChangeEventDetails(REASONS.none, event));
    }

    panel.addEventListener('beforematch', handleBeforeMatch);
    _c.push(() => {
      panel.removeEventListener('beforematch', handleBeforeMatch);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  return {
    props: {
      get hidden() {
        return hidden();
      },
      get id() {
        return id();
      },
    },
    setRef: (el) => handlePanelRef(el),
  };
}

export interface UseCollapsiblePanelParameters {
  abortControllerRef: ReactLikeRef<AbortController | null>;
  animationTypeRef: ReactLikeRef<AnimationType>;
  /**
   * The height of the panel.
   */
  height: MaybeAccessor<number | undefined>;
  /**
   * Allows the browser’s built-in page search to find and expand the panel contents.
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
   * Whether the collapsible panel is currently mounted.
   */
  mounted: MaybeAccessor<boolean>;
  onOpenChange: (open: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => void;
  /**
   * Whether the collapsible panel is currently open.
   */
  open: MaybeAccessor<boolean>;
  panelRef: ReactLikeRef<HTMLElement | null | undefined>;
  runOnceAnimationsFinish: (fnToExecute: () => void, signal?: AbortSignal | null) => void;
  setDimensions: (nextDimensions: Dimensions) => void;
  setMounted: (nextMounted: boolean) => void;
  setOpen: (nextOpen: boolean) => void;
  setVisible: (nextVisible: boolean) => void;
  transitionDimensionRef: ReactLikeRef<'height' | 'width' | null>;
  /**
   * The visible state of the panel used to determine the `[hidden]` attribute
   * only when CSS keyframe animations are used.
   */
  visible: MaybeAccessor<boolean>;
  /**
   * The width of the panel.
   */
  width: MaybeAccessor<number | undefined>;
}

export interface UseCollapsiblePanelReturnValue {
  setRef: (el: HTMLElement | null | undefined) => void;
  props: HTMLProps;
}

export namespace useCollapsiblePanel {
  export type Parameters = UseCollapsiblePanelParameters;
  export type ReturnValue = UseCollapsiblePanelReturnValue;
}
