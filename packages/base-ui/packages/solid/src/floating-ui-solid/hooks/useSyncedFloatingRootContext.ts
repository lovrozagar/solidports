/* eslint-disable typescript/no-explicit-any -- generic State extends PopupStoreState<any> */
import { isElement } from '@floating-ui/utils/dom';
import { untrack } from 'solid-js';
import { access, createDepsMemo, type MaybeAccessor } from '../../solid-helpers';
import { BaseUIChangeEventDetails } from '../../types';
import type { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { FloatingRootState, FloatingRootStore } from '../components/FloatingRootStoreV2';

/**
 * Narrowed to the store members this hook uses so consumers do not need to provide
 * unrelated store capabilities.
 */
export type SyncedFloatingRootContextStore<State extends PopupStoreState<any>> = Pick<
  SolidStore<State, PopupStoreContext<any>, PopupStoreSelectors>,
  'context' | 'state' | 'useState' | 'useSyncedValue'
>;

export interface UseSyncedFloatingRootContextOptions<State extends PopupStoreState<any>> {
  popupStore: SyncedFloatingRootContextStore<State>;
  /**
   * Whether the Popup element is passed to Floating UI as the floating element instead of the default Positioner.
   */
  treatPopupAsFloatingElement?: boolean | undefined;
  /**
   * The floating root to keep in sync, owned by the popup store. Created here when omitted.
   */
  floatingRootContext?: FloatingRootStore | undefined;
  floatingId: MaybeAccessor<string | undefined>;
  nested: boolean;
  onOpenChange(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
}

/**
 * Keeps a FloatingRootStore in sync with the provided PopupStore.
 * Uses the provided FloatingRootStore when one exists, otherwise creates one once.
 */
export function useSyncedFloatingRootContext<State extends PopupStoreState<any>>(
  options: UseSyncedFloatingRootContextOptions<State>,
): FloatingRootStore {
  const popupStore = untrack(() => options.popupStore);
  const treatPopupAsFloatingElement = untrack(() => options.treatPopupAsFloatingElement ?? false);
  const floatingId = () => access(options.floatingId);
  const nested = untrack(() => options.nested);

  const open = popupStore.useState('open');
  const referenceElement = popupStore.useState('activeTriggerElement');
  const floatingElement = popupStore.useState(
    treatPopupAsFloatingElement ? 'popupElement' : 'positionerElement',
  );

  const store =
    untrack(() => options.floatingRootContext) ??
    // Initial values only, like React's one-time construction.
    untrack(() =>
      FloatingRootStore({
        floatingElement: floatingElement(),
        floatingId: floatingId(),
        nested,
        onOpenChange: options.onOpenChange,
        open: open(),
        referenceElement: referenceElement(),
        syncOnly: true,
        transitionStatus: undefined,
        triggerElements: popupStore.context.triggerElements,
      }),
    );

  popupStore.useSyncedValue('floatingId', floatingId as () => State['floatingId']);

  // React syncs these into the floating root store together (a change to any of them writes them
  // all). Solid derives them, so the floating store changes in the same flush as the popup store.
  const synced = createDepsMemo(() => ({
    open: open(),
    floatingId: floatingId(),
    referenceElement: referenceElement(),
    floatingElement: floatingElement(),
  }));
  store.useSyncedValue('open', () => synced().open);
  store.useSyncedValue('floatingId', () => synced().floatingId);
  store.useSyncedValue('referenceElement', () => synced().referenceElement);
  store.useSyncedValue('floatingElement', () => synced().floatingElement);
  // Only an element reference updates the DOM reference.
  store.useSyncedValue('domReferenceElement', (prev) => {
    const reference = synced().referenceElement;
    return isElement(reference) ? reference : prev;
  });
  // The position reference follows the reference element unless it was set to something else.
  let previousReferenceElement = untrack(referenceElement);
  store.useSyncedValue('positionReference', (prev) => {
    const reference = synced().referenceElement;
    const next = prev === previousReferenceElement ? reference : prev;
    previousReferenceElement = reference;
    return next;
  });

  // Keep non-reactive context values fresh for interactions that call `store.setOpen`.
  store.context.onOpenChange = options.onOpenChange;
  store.context.nested = nested;

  return store;
}
