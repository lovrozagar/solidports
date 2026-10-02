import { createTrackedEffect, onCleanup } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { ToastManager, ToastManagerEvent } from '../createToastManager';
import { ToastStore } from '../store';
import { ToastContext } from './ToastProviderContext';

/**
 * Provides a context for creating and managing toasts.
 *
 * Documentation: [Base UI Toast](https://base-ui.com/react/components/toast)
 */
export function ToastProvider(props: ToastProvider.Props) {
  const timeout = () => props.timeout ?? 5000;
  const limit = () => props.limit ?? 3;

  const store = ToastStore({
    focused: false,
    hovering: false,
    isWindowFocused: true,
    get limit() {
      return limit();
    },
    prevFocusElement: null,
    get timeout() {
      return timeout();
    },
    toasts: [],
    viewport: null,
  });

  onCleanup(() => {
    store.disposeEffect();
  });

  const onUnsubscribe = ({ action, options }: ToastManagerEvent) => {
    const id = options.id;

    if (action === 'promise' && options.promise) {
      store.promiseToast(options.promise, options);
    } else if (action === 'update' && id) {
      store.updateToast(() => id, options);
    } else if (action === 'close') {
      store.closeToast(id ? () => id : undefined);
    } else {
      store.addToast(options);
    }
  };

  store.useSyncedValues({ limit, timeout });

  createTrackedEffect(function subscribeToToastManager() {
    const _c: Array<() => void> = [];
    (() => {

    if (!props.toastManager) {
      return;
    }

    const unsubscribe = props.toastManager[' subscribe'](onUnsubscribe);
    _c.push(unsubscribe);
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  return <ToastContext value={store}>{props.children}</ToastContext>;
}

export interface ToastProviderProps {
  children?: JSX.Element;
  /**
   * The default amount of time (in ms) before a toast is auto dismissed.
   * A value of `0` will prevent the toast from being dismissed automatically.
   * @default 5000
   */
  timeout?: number | undefined;
  /**
   * The maximum number of toasts that can be displayed at once.
   * When the limit is reached, the oldest toast will be removed to make room for the new one.
   * @default 3
   */
  limit?: number | undefined;
  /**
   * A global manager for toasts to use outside of a React component.
   */
  toastManager?: ToastManager | undefined;
}

export namespace ToastProvider {
  export type Props = ToastProviderProps;
}
