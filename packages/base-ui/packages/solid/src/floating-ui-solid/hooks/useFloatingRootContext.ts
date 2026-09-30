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
    createEffect(() => {
      const optionDomReference = props.elements?.reference;
      if (optionDomReference && !isElement(optionDomReference)) {
        console.error(
          'Cannot pass a virtual element to the `elements.reference` option,',
          'as it must be a real DOM element. Use `refs.setPositionReference()`',
          'instead.',
        );
      }
    });
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

  createEffect(() => {
    const ref = props.elements?.reference;
    const valuesToSync: Writeable<Partial<FloatingRootState>> = {
      floatingId: floatingId(),
      open: props.open,
    };

    // Only sync elements that are defined to avoid overwriting existing ones
    if (ref !== undefined) {
      valuesToSync.referenceElement = ref;
      valuesToSync.domReferenceElement = isElement(ref) ? ref : null;
    }

    if (props.elements?.floating !== undefined) {
      valuesToSync.floatingElement = props.elements.floating;
    }

    store.context.onOpenChange = props.onOpenChange;
    store.context.nested = nested;

    store.update(valuesToSync);
  });

  return store;
}

type Writeable<T> = { -readonly [P in keyof T]: T[P] };
