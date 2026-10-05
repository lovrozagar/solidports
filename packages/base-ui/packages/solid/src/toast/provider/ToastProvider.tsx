import { createEffect, onSettled, untrack } from 'solid-js';
import { createLayoutEffect } from '../../solid-helpers';
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

  const store = ToastStore(
    untrack(() => ({
      timeout: timeout(),
      limit: limit(),
      viewport: null,
      toasts: [],
      hovering: false,
      focused: false,
      isWindowFocused: true,
      prevFocusElement: null,
    })),
  );

  onSettled(store.disposeEffect);

  createEffect(
    () => props.toastManager,
    function subscribeToToastManager(toastManager) {
      if (!toastManager) {
        return undefined;
      }

      const unsubscribe = toastManager[' subscribe'](({ action, options }: ToastManagerEvent) => {
        const id = options.id;

        if (action === 'promise' && options.promise) {
          store.promiseToast(options.promise, options);
        } else if (action === 'update' && id) {
          store.updateToast(id, options.updates);
        } else if (action === 'close') {
          store.closeToast(id);
        } else {
          store.addToast(options);
        }
      });

      return unsubscribe;
    },
  );

  return (
    <ToastContext value={store}>
      <ToastProviderPropsSynchronizer store={store} timeout={timeout()} limit={limit()} />
      {props.children}
    </ToastContext>
  );
}

function ToastProviderPropsSynchronizer(props: {
  store: ToastStore;
  timeout: number;
  limit: number;
}) {
  // `limit` needs custom syncing because changing it must also recompute each
  // toast's `limited` flag; `useSyncedValues` would only update the raw value.
  createLayoutEffect(
    () => [props.timeout, props.limit] as const,
    ([timeout, limit]) => {
      props.store.syncProviderProps(timeout, limit);
    },
  );

  return null;
}

export interface ToastProviderState {}

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
   * When the limit is exceeded, the oldest toasts are marked as `limited` (via the `data-limited`
   * attribute) rather than removed, so they can be hidden or animated out.
   * @default 3
   */
  limit?: number | undefined;
  /**
   * A global manager for toasts to use outside of a React component.
   */
  toastManager?: ToastManager | undefined;
}

export namespace ToastProvider {
  export type State = ToastProviderState;
  export type Props = ToastProviderProps;
}
