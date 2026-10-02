/* eslint-disable typescript/no-explicit-any -- generic State extends PopupStoreState<any> */
import { isElement } from '@floating-ui/utils/dom';
import { untrack } from 'solid-js';
import { access, createDepsRenderEffect, type MaybeAccessor } from '../../solid-helpers';
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

  createDepsRenderEffect(
    () => ({
      open: open(),
      floatingId: floatingId(),
      referenceElement: referenceElement(),
      floatingElement: floatingElement(),
    }),
    (values) => {
      const valuesToSync: Partial<FloatingRootState> = { ...values };

      if (isElement(values.referenceElement)) {
        valuesToSync.domReferenceElement = values.referenceElement;
      }

      // Compared against the latest store values (React reads them while rendering).
      if (store.state.positionReference === store.state.referenceElement) {
        valuesToSync.positionReference = values.referenceElement;
      }

      store.update(valuesToSync);
    },
  );

  // Keep non-reactive context values fresh for interactions that call `store.setOpen`.
  store.context.onOpenChange = options.onOpenChange;
  store.context.nested = nested;

  return store;
}
