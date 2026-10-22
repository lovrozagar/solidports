import type { FloatingEvents } from '../types';

export function createEventEmitter(): FloatingEvents {
  // Created by the first listener: a closed popup's root store has none, and an empty Map costs a
  // table of its own.
  let map: Map<string, Set<(data: any) => void>> | undefined;
  return {
    emit(event: string, data: any) {
      map?.get(event)?.forEach((listener) => listener(data));
    },
    off(event: string, listener: (data: any) => void) {
      map?.get(event)?.delete(listener);
    },
    on(event: string, listener: (data: any) => void) {
      map ??= new Map();
      let set = map.get(event);
      if (!set) {
        set = new Set();
        map.set(event, set);
      }
      set.add(listener);
    },
  };
}
