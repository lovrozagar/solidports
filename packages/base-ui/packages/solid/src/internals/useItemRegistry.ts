import { createMemo, createSignal, runWithOwner, untrack } from 'solid-js';
import { createDepsEffect } from '../solid-helpers';

type RegisterItem<Key, Item> = (key: Key, item: Item) => () => void;

/**
 * Collects item registrations into one immutable snapshot per flush.
 * Also returns the live registry for reads that must include registrations made before the
 * snapshot is published.
 */
export function useItemRegistry<Key, Item>(): ItemRegistry<Key, Item> {
  const itemRegistry = new Map<Key, Item>();
  const [registryVersion, setRegistryVersion] = createSignal(0, { ownedWrite: true });
  let isUpdateScheduled = false;

  // Item effects can run without their parent rendering. Schedule one parent update for the
  // whole flush so every registration is included in the next snapshot.
  const scheduleRegistryUpdate = () => {
    if (isUpdateScheduled) {
      return;
    }
    isUpdateScheduled = true;
    runWithOwner(null, () => untrack(() => setRegistryVersion((version) => version + 1)));
  };

  const registerItem: RegisterItem<Key, Item> = (key, item) => {
    itemRegistry.set(key, item);
    scheduleRegistryUpdate();

    return () => {
      itemRegistry.delete(key);
      scheduleRegistryUpdate();
    };
  };

  const items = createMemo(() => {
    registryVersion();
    return new Map(itemRegistry);
  });

  createDepsEffect(
    () => registryVersion(),
    () => {
      isUpdateScheduled = false;
    },
  );

  return {
    get items() {
      return items();
    },
    registerItem,
    liveItems: itemRegistry,
  };
}

export interface ItemRegistry<Key, Item> {
  /** The snapshot published after the latest flush's registrations. */
  items: ReadonlyMap<Key, Item>;
  registerItem: RegisterItem<Key, Item>;
  /** The registry itself, including registrations whose snapshot hasn't been published yet. */
  liveItems: ReadonlyMap<Key, Item>;
}
