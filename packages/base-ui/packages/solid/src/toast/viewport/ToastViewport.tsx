import { createTrackedEffect, createMemo, For, onCleanup, Show } from 'solid-js';
import { activeElement, contains, getTarget } from '../../floating-ui-solid/utils';
import { splitComponentProps } from '../../solid-helpers';
import { FocusGuard } from '../../utils/FocusGuard';
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

  const isEmpty = store.useState('isEmpty');
  const toasts = store.useState('toasts');
  const focused = store.useState('focused');
  const expanded = store.useState('expanded');
  const prevFocusElement = store.useState('prevFocusElement');
  const frontmostHeight = () => toasts()[0]?.height ?? 0;

  const hasTransitioningToasts = createMemo(() =>
    toasts().some((toast: ToastObject<any>) => toast.transitionStatus === 'ending'),
  );

  // Listen globally for F6 so we can force-focus the viewport.
  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const viewport = store.state.viewport ?? null;
    if (!viewport) {
      return;
    }

    function handleGlobalKeyDown(event: KeyboardEvent) {
      if (isEmpty()) {
        return;
      }

      if (event.key === 'F6' && event.target !== viewport) {
        event.preventDefault();
        store.setPrevFocusElement(activeElement(ownerDocument(viewport)) as HTMLElement | null);
        viewport?.focus({ preventScroll: true });
        store.pauseTimers();
        store.setFocused(true);
      }
    }

    const win = ownerWindow(viewport);

    win.addEventListener('keydown', handleGlobalKeyDown);

    _c.push(() => {
      win.removeEventListener('keydown', handleGlobalKeyDown);
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

    const viewport = store.state.viewport ?? null;
    if (!viewport || isEmpty()) {
      return;
    }

    const win = ownerWindow(viewport);

    function handleWindowBlur(event: FocusEvent) {
      if (event.target !== win) {
        return;
      }

      store.setIsWindowFocused(false);
      store.pauseTimers();
    }

    function handleWindowFocus(event: FocusEvent) {
      if (event.relatedTarget) {
        return;
      }

      const target = getTarget(event);
      if (target === win) {
        return;
      }

      const activeEl = activeElement(ownerDocument(viewport));
      if (!contains(viewport, target as HTMLElement | null) || !isFocusVisible(activeEl)) {
        store.resumeTimers();
      }

      // Wait for the `handleFocus` event to fire.
      windowFocusTimeout.start(0, () => store.setIsWindowFocused(true));
    }

    win.addEventListener('blur', handleWindowBlur, true);
    win.addEventListener('focus', handleWindowFocus, true);

    _c.push(() => {
      win.removeEventListener('blur', handleWindowBlur, true);
      win.removeEventListener('focus', handleWindowFocus, true);
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

    const viewport = store.state.viewport ?? null;
    if (!viewport || isEmpty()) {
      return;
    }

    const doc = ownerDocument(viewport);

    doc.addEventListener('pointerdown', store.handleDocumentPointerDown, true);

    _c.push(() => {
      doc.removeEventListener('pointerdown', store.handleDocumentPointerDown, true);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  function handleFocusGuard(event: FocusEvent) {
    const viewport = store.state.viewport ?? null;
    if (!viewport) {
      return;
    }

    handlingFocusGuardRef = true;

    // If we're coming off the container, move to the first toast
    if (event.relatedTarget === viewport) {
      store.getToastRef(toasts()[0]?.id)?.focus();
    } else {
      store.restoreFocusToPrevElement();
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Tab' && event.shiftKey && getTarget(event) === store.state.viewport) {
      event.preventDefault();
      store.restoreFocusToPrevElement();
      store.resumeTimers();
    }
  }

  function flushMouseLeave() {
    if (!store.state.isWindowFocused || hasTransitioningToasts() || touchActiveRef) {
      return;
    }

    store.resumeTimers();
    store.setHovering(false);
    markedReadyForMouseLeaveRef = false;
  }

  createTrackedEffect(() => {
    if (!store.state.isWindowFocused || hasTransitioningToasts() || !markedReadyForMouseLeaveRef) {
      return;
    }

    /* Once transitions have settled, flush a blocked mouseleave. */
    flushMouseLeave();
  });

  function handleMouseEnter() {
    store.pauseTimers();
    store.setHovering(true);
    markedReadyForMouseLeaveRef = false;
  }

  function handlePointerDown(event: PointerEvent) {
    if (event.pointerType === 'touch') {
      touchActiveRef = true;
    }
  }

  function handlePointerEnd(_event: PointerEvent) {
    touchActiveRef = false;
    flushMouseLeave();
  }

  function handleMouseLeave() {
    if (hasTransitioningToasts() || touchActiveRef) {
      /* When swiping to dismiss, or touch is active, defer until settled. */
      markedReadyForMouseLeaveRef = true;
    } else {
      store.resumeTimers();
      store.setHovering(false);
    }
  }

  function handleFocus() {
    if (handlingFocusGuardRef) {
      handlingFocusGuardRef = false;
      return;
    }

    if (focused()) {
      return;
    }

    /* Only expand on keyboard focus — prevents staying expanded when clicking. */
    if (isFocusVisible(activeElement(ownerDocument(store.state.viewport ?? null)))) {
      store.setFocused(true);
      store.pauseTimers();
    }
  }

  function handleBlur(event: FocusEvent) {
    if (!focused() || contains(store.state.viewport, event.relatedTarget as HTMLElement | null)) {
      return;
    }

    store.setFocused(false);
    store.resumeTimers();
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
