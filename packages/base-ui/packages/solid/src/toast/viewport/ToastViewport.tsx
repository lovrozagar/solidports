import { createEffect, createMemo, For, Show, untrack } from 'solid-js';
import { activeElement, contains, getTarget } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import { addEventListener } from '../../utils/addEventListener';
import { FocusGuard } from '../../utils/FocusGuard';
import { mergeCleanups } from '../../utils/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../utils/owner';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useTimeout } from '../../utils/useTimeout';
import { visuallyHidden } from '../../utils/visuallyHidden';
import { useToastProviderContext } from '../provider/ToastProviderContext';
import type { ToastObject } from '../useToastManager';
import { isFocusVisible } from '../utils/focusVisible';
import { ToastViewportCssVars } from './ToastViewportCssVars';

/**
 * A container viewport for toasts.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastViewport(componentProps: ToastViewport.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const store = useToastProviderContext();
  const windowFocusTimeout = useTimeout();

  let handlingFocusGuardRef = false;
  let markedReadyForMouseLeaveRef = false;
  let touchActiveRef = false;

  // Solid: a memo, so the listener effect below re-runs only when emptiness flips, as React's
  // `useStore` re-renders only on a changed selector value.
  const isEmpty = createMemo(store.useState('isEmpty'));
  const toasts = store.useState('toasts');
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');
  const prevFocusElement = store.useState('prevFocusElement');
  const frontmostHeight = () => toasts()[0]?.height ?? 0;

  const hasTransitioningToasts = createMemo(() =>
    toasts().some((toast: ToastObject<any>) => toast.transitionStatus === 'ending'),
  );

  createEffect(isEmpty, (empty) => {
    // `store.state.viewport` isn't available on the first render, since the portal node hasn't yet
    // been created. Depending on `isEmpty` ensures the listeners are attached once toasts exist and
    // the viewport ref is available.
    const viewport = untrack(() => store.state.viewport) ?? null;
    if (!viewport || empty) {
      return undefined;
    }

    const win = ownerWindow(viewport);
    const doc = ownerDocument(viewport);

    // Listen globally for F6 so we can force-focus the viewport.
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (event.key === 'F6' && getTarget(event) !== viewport) {
        event.preventDefault();
        store.set('prevFocusElement', activeElement(doc) as HTMLElement | null);
        viewport?.focus({ preventScroll: true });
        store.pauseTimers();
        store.set('focused', true);
      }
    }

    function handleWindowBlur(event: FocusEvent) {
      if (getTarget(event) !== win) {
        return;
      }

      store.set('isWindowFocused', false);
      store.pauseTimers();
    }

    function handleWindowFocus(event: FocusEvent) {
      if (event.relatedTarget) {
        return;
      }

      const target = getTarget(event);
      const activeEl = activeElement(doc);
      if (
        target === win ||
        !contains(viewport, target as HTMLElement | null) ||
        !isFocusVisible(activeEl)
      ) {
        store.resumeTimers();
      }

      // Wait for the `handleFocus` event to fire.
      windowFocusTimeout.start(0, () => store.set('isWindowFocused', true));
    }

    return mergeCleanups(
      addEventListener(win, 'keydown', handleGlobalKeyDown),
      addEventListener(win, 'blur', handleWindowBlur, true),
      addEventListener(win, 'focus', handleWindowFocus, true),
      addEventListener(doc, 'pointerdown', store.handleDocumentPointerDown, true),
    );
  });

  function handleFocusGuard(event: FocusEvent) {
    handlingFocusGuardRef = true;

    // If we're coming off the container, move to the first toast that can hold
    // focus, skipping toasts that are animating out or inert because they're limited.
    const firstFocusableToast =
      event.relatedTarget === store.state.viewport
        ? store.state.toasts.find(
            (toast: ToastObject<any>) => toast.transitionStatus !== 'ending' && !toast.limited,
          )
        : undefined;

    if (firstFocusableToast) {
      firstFocusableToast.ref?.current?.focus();
    } else {
      store.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab' && event.shiftKey && getTarget(event) === store.state.viewport) {
      event.preventDefault();
      // Restoring focus blurs the viewport, and `handleBlur` resumes the timers
      // from there. Resuming here as well would also fire when the previously
      // focused element lives inside the viewport, letting toasts dismiss out
      // from under the keyboard.
      store.restoreFocusToPrevElement();
    }
  }

  function flushMouseLeave() {
    const hasEndingToasts = store.state.toasts.some(
      (toast: ToastObject<any>) => toast.transitionStatus === 'ending',
    );

    if (hasEndingToasts || touchActiveRef || !markedReadyForMouseLeaveRef) {
      return;
    }

    // Once transitions have finished, see if a mouseleave was already triggered
    // but blocked from taking effect. If so, we can now safely collapse the viewport
    // without restarting timers while the window is blurred.
    if (store.state.isWindowFocused) {
      store.resumeTimers();
    }
    store.set('hovering', false);
    markedReadyForMouseLeaveRef = false;
  }

  createEffect(hasTransitioningToasts, () => {
    untrack(flushMouseLeave);
  });

  function handleMouseEnter() {
    store.pauseTimers();
    store.set('hovering', true);
    markedReadyForMouseLeaveRef = false;
  }

  function resumeTimersIfWindowFocused() {
    if (store.state.isWindowFocused) {
      store.resumeTimers();
    }
  }

  function handleMouseLeave() {
    // Defer to `flushMouseLeave`: while toasts are transitioning out or a touch gesture is active it
    // records the intent and collapses later; otherwise it collapses immediately.
    markedReadyForMouseLeaveRef = true;
    flushMouseLeave();
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touchActiveRef = true;
    }
  }

  function handlePointerEnd(event: PointerEvent) {
    if (event.pointerType !== 'touch') {
      return;
    }

    touchActiveRef = false;
    flushMouseLeave();
  }

  function handleFocus() {
    if (handlingFocusGuardRef) {
      handlingFocusGuardRef = false;
      return;
    }

    if (focused()) {
      return;
    }

    // Only set focused when the active element is focus-visible.
    // This prevents the viewport from staying expanded when clicking inside without
    // keyboard navigation.
    if (isFocusVisible(activeElement(ownerDocument(store.state.viewport ?? null)))) {
      store.set('focused', true);
      store.pauseTimers();
    }
  }

  function handleBlur(event: FocusEvent) {
    if (!focused() || contains(store.state.viewport, event.relatedTarget as HTMLElement | null)) {
      return;
    }

    store.set('focused', false);
    resumeTimersIfWindowFocused();
  }

  const defaultProps: HTMLProps = {
    'aria-atomic': 'false',
    'aria-label': 'Notifications',
    'aria-live': 'polite',
    'aria-relevant': 'additions text',
    onBlur: handleBlur,
    onClick: handleFocus,
    onFocus: handleFocus,
    onKeyDown: handleKeyDown,
    onMouseEnter: handleMouseEnter,
    onMouseLeave: handleMouseLeave,
    onMouseMove: handleMouseEnter,
    onPointerCancel: handlePointerEnd,
    onPointerDown: handlePointerDown,
    onPointerUp: handlePointerEnd,
    role: 'region',
    tabindex: -1,
  };

  const state: ToastViewport.State = {
    get expanded() {
      return expanded();
    },
  };

  const element = useRenderElement('div', componentProps, {
    get children() {
      return (
        <>
          <Show when={!isEmpty() && prevFocusElement()}>
            <FocusGuard onFocus={handleFocusGuard} />
          </Show>
          {componentProps.children}
          <Show when={!isEmpty() && prevFocusElement()}>
            <FocusGuard onFocus={handleFocusGuard} />
          </Show>
        </>
      );
    },
    props: [
      defaultProps,
      {
        get style() {
          return {
            [ToastViewportCssVars.frontmostHeight as string]: frontmostHeight()
              ? `${frontmostHeight()}px`
              : undefined,
          };
        },
      },
      elementProps,
    ],
    ref: (el) => {
      store.setViewport(el);
    },
    state,
  });

  const highPriorityToasts = createMemo(() => {
    return toasts().filter((toast: ToastObject<any>) => toast.priority === 'high');
  });

  return (
    <>
      <Show when={!isEmpty() && prevFocusElement()}>
        <FocusGuard onFocus={handleFocusGuard} />
      </Show>
      {element()}
      <Show when={!focused() && highPriorityToasts().length > 0}>
        <div style={visuallyHidden}>
          <For each={highPriorityToasts()}>
            {(toast) => (
              <div role="alert" aria-atomic="true">
                <div>{toast.title}</div>
                <div>{toast.description}</div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

export interface ToastViewportState {
  /**
   * Whether toasts are expanded in the viewport.
   */
  expanded: boolean;
}

export interface ToastViewportProps extends BaseUIComponentProps<'div', ToastViewport.State> {}

export namespace ToastViewport {
  export type State = ToastViewportState;
  export type Props = ToastViewportProps;
}
