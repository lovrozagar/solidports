import { PopupTriggerMap } from '../../utils/popups';
import { FloatingRootStore } from '../components/FloatingRootStoreV2';
import type { FloatingRootContext } from '../types';

export function getEmptyRootContext(): FloatingRootContext {
  return FloatingRootStore({
    floatingElement: null,
    floatingId: '',
    nested: false,
    onOpenChange: undefined,
    open: false,
    referenceElement: null,
    syncOnly: false,
    triggerElements: new PopupTriggerMap(),
  });
}
