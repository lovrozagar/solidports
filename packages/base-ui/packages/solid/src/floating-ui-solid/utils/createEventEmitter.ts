/* eslint-disable typescript/no-explicit-any -- emitter event payloads are arbitrary, mirrors @floating-ui/react */
import type { FloatingEvents } from '../types';

export function createEventEmitter(): FloatingEvents {
  const map = new Map<string, Set<(data: any) => void>>();
  return {
    emit(event: string, data: any) {
      map.get(event)?.forEach((listener) => listener(data));
    },
    off(event: string, listener: (data: any) => void) {
      map.get(event)?.delete(listener);
    },
    on(event: string, listener: (data: any) => void) {
      let set = map.get(event);
      if (!set) {
        set = new Set();
        map.set(event, set);
      }
      set.add(listener);
    },
  };
}
