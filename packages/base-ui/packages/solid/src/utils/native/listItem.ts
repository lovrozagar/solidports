/*
 * Composite list registration for native parts: `useCompositeListItem` for an
 * item with an automatic index, no label and no text ref. The registration data is read once when
 * it is static; a reactive metadata accessor re-registers from one effect. One signal (the index)
 * instead of the hook's signal + effect + render effect; the list sees the same registrations in
 * the same order. An optional index guess from the creation order avoids the post-flush re-render.
 */
import { createEffect, createSignal, onCleanup, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import { isServer } from '@solidjs/web';
import { useCompositeListContext } from '../../internals/composite/list/CompositeListContext';
import type {
  CompositeListContextValue,
  CompositeListIndexSink,
  CompositeListRegistration,
} from '../../internals/composite/list/CompositeListContext';

const noop = () => {};

export interface NativeListItem {
  /** Registers the element (with `null`: unregisters it), as the hook's ref. */
  setRef: (node: HTMLElement | null | undefined) => void;
  /** The item's index in the list (`-1` until the list's first flush). */
  index: Accessor<number>;
}

/**
 * One native list item: its registration with the list, and the list's index sink (`current`,
 * `set`) and owner key in one object, so an item allocates this record, its index signal and its
 * ref and cleanup functions.
 */
class ListItemRecord<Metadata> implements NativeListItem, CompositeListIndexSink {
  declare current: number;
  declare readonly index: Accessor<number>;
  declare readonly set: (index: number) => void;
  declare readonly setRef: (node: HTMLElement | null | undefined) => void;
  declare private readonly list: CompositeListContextValue<Metadata>;
  declare private readonly metadata: Metadata | null | Accessor<Metadata | null>;
  declare private element: Element | null;
  declare private registration: CompositeListRegistration<Metadata> | null;

  constructor(
    list: CompositeListContextValue<Metadata>,
    metadata: Metadata | null | Accessor<Metadata | null>,
    guessed: number,
  ) {
    // The list sets the index only when a flush moves it.
    [this.index, this.set] = createSignal(guessed);
    this.current = guessed;
    this.list = list;
    this.metadata = metadata;
    this.element = null;
    this.registration = null;
    this.setRef = (node) => this.attach(node);
    void onCleanup(() => this.dispose());
  }

  private attach(node: HTMLElement | null | undefined) {
    const element = this.element;
    if (element && element !== node) {
      // The record is the owner key: it tells this item's registration apart when nested items
      // share one DOM node.
      this.list.unregister(element, this);
    }
    this.element = node ?? null;
    if (node) {
      const metadata = this.metadata;
      this.register(
        node,
        typeof metadata === 'function'
          ? untrack(metadata as Accessor<Metadata | null>)
          : (metadata as Metadata | null),
      );
    }
  }

  update(data: Metadata | null) {
    const element = this.element;
    if (element && (this.registration === null || this.registration.metadata !== data)) {
      this.register(element, data);
    }
  }

  private register(node: Element, data: Metadata | null) {
    this.registration = { metadata: data, index: null, label: undefined, textRef: undefined };
    this.list.register(node, this.registration, this, this);
  }

  private dispose() {
    if (this.element) {
      this.list.unregister(this.element, this);
    }
  }
}

export function createNativeListItem<Metadata>(
  metadata: Metadata | null | Accessor<Metadata | null>,
  options?: { guessIndex?: boolean | undefined },
): NativeListItem {
  const list = useCompositeListContext() as CompositeListContextValue<Metadata>;
  // `guessIndex`: the index is guessed from the creation order (`IndexGuessBehavior.GuessFromOrder`)
  // so a list rendered in DOM order is right on its first render and the list's flush confirms it
  // (no effect re-runs); a wrong guess is corrected by the flush.
  let guessed = -1;
  if (options?.guessIndex) {
    guessed = list.nextIndexRef.current;
    list.nextIndexRef.current += 1;
  }
  const reactive = typeof metadata === 'function';
  if (isServer) {
    // The server never calls refs and its list never flushes: the index stays the guess. A
    // reactive metadata accessor still gets its effect, which takes a hydration id the client's
    // matches.
    if (reactive) {
      createEffect(metadata as Accessor<Metadata | null>, () => {});
    }
    return { setRef: noop, index: () => guessed };
  }
  const item = new ListItemRecord(list, metadata, guessed);
  if (reactive) {
    createEffect(metadata as Accessor<Metadata | null>, (data) => item.update(data));
  }
  return item;
}
