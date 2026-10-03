/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { isElement } from '@floating-ui/utils/dom';
import { createEffect } from 'solid-js';
import { defaultProps } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { PopupTriggerMap } from '../../utils/popups';
import { useId } from '../../utils/useId';
import { FloatingRootStore, type FloatingRootState } from '../components/FloatingRootStoreV2';
import { useFloatingParentNodeId } from '../components/FloatingTree';
import type { ReferenceType } from '../types';

export interface UseFloatingRootContextOptions {
  open?: boolean | undefined;
  onOpenChange?: (open: boolean, eventDetails: BaseUIChangeEventDetails<string>) => void;
  elements?:
    | {
        reference?: ReferenceType | null | undefined;
        floating?: HTMLElement | null | undefined;
      }
    | undefined;
}

export function useFloatingRootContext(options: UseFloatingRootContextOptions): FloatingRootStore {
  const props = defaultProps(options, { elements: {} as any, open: false });
  const floatingId = useId();
  const nested = useFloatingParentNodeId() != null;

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => props.elements?.reference,
      (optionDomReference) => {
        if (optionDomReference && !isElement(optionDomReference)) {
          console.error(
            'Cannot pass a virtual element to the `elements.reference` option,',
            'as it must be a real DOM element. Use `refs.setPositionReference()`',
            'instead.',
          );
        }
      },
    );
  }

  const store = FloatingRootStore({
    get floatingElement() {
      return props.elements?.floating ?? null;
    },
    get floatingId() {
      return floatingId();
    },
    nested,
    get onOpenChange() {
      return props.onOpenChange;
    },
    get open() {
      return props.open;
    },
    get referenceElement() {
      return props.elements?.reference ?? null;
    },
    syncOnly: false,
    triggerElements: new PopupTriggerMap(),
  });

  // `open` and the id derive in the same flush (store bindings), so readers never see the new open
  // state with a stale store value.
  store.useSyncedValue('open', () => props.open);
  store.useSyncedValue('floatingId', floatingId);

  // The elements re-sync whenever an option changes, `open` included (React's `useSyncedValues`
  // writes them all on every render), dropping elements set elsewhere since. Equal values are not
  // written.
  createEffect(
    () => {
      const ref = props.elements?.reference;
      // Read for its change: reopening re-syncs the elements.
      void props.open;
      const valuesToSync: Writeable<Partial<FloatingRootState>> = {};

      // Only sync elements that are defined to avoid overwriting existing ones
      if (ref !== undefined) {
        valuesToSync.referenceElement = ref;
        valuesToSync.domReferenceElement = isElement(ref) ? ref : null;
      }

      if (props.elements?.floating !== undefined) {
        valuesToSync.floatingElement = props.elements.floating;
      }

      return { valuesToSync, onOpenChange: props.onOpenChange };
    },
    ({ valuesToSync, onOpenChange }) => {
      store.context.onOpenChange = onOpenChange;
      store.context.nested = nested;
      store.update(valuesToSync);
    },
  );

  return store;
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
