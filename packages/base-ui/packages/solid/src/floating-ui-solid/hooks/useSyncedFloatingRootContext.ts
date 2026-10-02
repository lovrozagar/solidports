/* eslint-disable typescript/no-explicit-any -- generic State extends PopupStoreState<any> */
import { isElement } from '@floating-ui/utils/dom';
import { createEffect } from 'solid-js';
import { defaultProps } from '../../solid-helpers';
import { BaseUIChangeEventDetails } from '../../types';
import type { PopupStoreContext, PopupStoreSelectors, PopupStoreState } from '../../utils/popups';
import { SolidStore } from '../../utils/store/SolidStoreV2';
import { useId } from '../../utils/useId';
import { FloatingRootState, FloatingRootStore } from '../components/FloatingRootStoreV2';
import { useFloatingParentNodeId } from '../components/FloatingTree';

export interface UseSyncedFloatingRootContextOptions<State extends PopupStoreState<any>> {
  popupStore: SolidStore<State, PopupStoreContext<any>, PopupStoreSelectors>;
  /**
   * Whether the Popup element is passed to Floating UI as the floating element instead of the default Positioner.
   */
  treatPopupAsFloatingElement?: boolean | undefined;
  onOpenChange(open: boolean, eventDetails: BaseUIChangeEventDetails<string>): void;
}

/**
 * Initializes a FloatingRootStore that is kept in sync with the provided PopupStore.
 * The new instance is created only once and updated on every render.
 */
export function useSyncedFloatingRootContext<State extends PopupStoreState<any>>(
  options: UseSyncedFloatingRootContextOptions<State>,
): FloatingRootStore {
  const props = defaultProps(options, { treatPopupAsFloatingElement: false });

  const floatingId = useId();
  const nested = useFloatingParentNodeId() != null;

  const open = props.popupStore.useState('open');
  const referenceElement = props.popupStore.useState('activeTriggerElement');
  const floatingElement = props.popupStore.useState(
    props.treatPopupAsFloatingElement ? 'popupElement' : 'positionerElement',
  );

  const store = FloatingRootStore({
    get floatingElement() {
      return floatingElement();
    },
    get floatingId() {
      return floatingId();
    },
    get nested() {
      return nested;
    },
    onOpenChange: options.onOpenChange,
    get open() {
      return open();
    },
    get referenceElement() {
      return referenceElement();
    },
    syncOnly: false,
    get triggerElements() {
      return options.popupStore.context.triggerElements;
    },
  });

  createEffect(
    () => {
      const ref = referenceElement();
      const valuesToSync: Partial<FloatingRootState> = {
        floatingElement: floatingElement(),
        floatingId: floatingId(),
        open: open(),
        referenceElement: ref,
      };

      if (isElement(ref)) {
        valuesToSync.domReferenceElement = ref;
      }

      if (store.state.positionReference === store.state.referenceElement) {
        valuesToSync.positionReference = ref;
      }

      return valuesToSync;
    },
    (valuesToSync) => {
      store.update(valuesToSync);
    },
  );

  return store;
}
