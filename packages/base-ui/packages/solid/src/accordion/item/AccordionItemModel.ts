import { createSignal, getOwner, untrack } from 'solid-js';
import type { Accessor, Owner, Setter } from 'solid-js';
import type { CollapsibleRoot } from '../../collapsible/root/CollapsibleRoot';
import { useCollapsibleRoot } from '../../collapsible/root/useCollapsibleRoot';
import type { CollapsibleRootModel } from '../../collapsible/root/useCollapsibleRoot';
import { isStaticProp } from '../../solid-helpers';
import { compileStateWriter } from '../../utils/native/element';
import { useBaseUiId } from '../../utils/useBaseUiId';
import type { AccordionRootContext } from '../root/AccordionRootContext';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import type { AccordionItem, AccordionItemState } from './AccordionItem';
import { accordionStateAttributesMapping } from './stateAttributesMapping';

/** An item's state keys, in the order its `data-*` attributes are written. */
export const ITEM_STATE_KEYS = ['value', 'orientation', 'hidden', 'index', 'disabled', 'open'];

/** The item's and the header's state attributes, compiled once. */
export const writeItemState = compileStateWriter(ITEM_STATE_KEYS, accordionStateAttributesMapping);

/**
 * An item's state keys as prototype getters, for the parts' precompiled attribute writers: creating
 * one costs far less than an object literal with own getters (`createItemState`).
 */
export class AccordionItemStateView {
  declare private readonly item: AccordionItemModel;

  constructor(item: AccordionItemModel) {
    this.item = item;
  }

  get value() {
    return this.item.root.state.value;
  }

  get orientation() {
    return this.item.root.state.orientation;
  }

  get hidden() {
    return this.item.hidden();
  }

  get index() {
    return this.item.index();
  }

  get disabled() {
    return this.item.disabled();
  }

  get open() {
    return this.item.open();
  }
}

type ItemProps = Pick<AccordionItem.Props, 'disabled' | 'onOpenChange' | 'value'>;

/**
 * An accordion item's open state, collapsible root and context, shared by both render paths and
 * provided as `AccordionItemContext`. Solid: the members are prototype methods, so an item
 * allocates one object rather than a closure per member. Call them on the object (`item.open()`);
 * the members a part passes on are fields.
 */
export class AccordionItemModel {
  /** Solid: the item's owner (the trigger skips its unmount registration write while the item is disposed). */
  declare readonly owner: Owner | null;
  declare readonly root: AccordionRootContext;
  /** The item's position in the root's list. */
  declare readonly index: Accessor<number>;
  /** The item's collapsible root, provided as `CollapsibleRootContext`. */
  declare readonly collapsible: CollapsibleRootModel;
  /** The trigger's generated id, used until a trigger registers its own. */
  declare readonly defaultTriggerId: Accessor<string | undefined>;
  /** `undefined` uses the generated fallback; `null` means the trigger unmounted. */
  declare readonly setTriggerId: Setter<string | null | undefined>;
  /** What the parts' attribute writers read: `state`'s keys, live (see `AccordionItemStateView`). */
  declare readonly stateView: AccordionItemStateView;

  declare private readonly local: ItemProps;
  declare private readonly fallbackValue: Accessor<string | undefined> | undefined;
  declare private readonly registeredTriggerId: Accessor<string | null | undefined>;
  declare private publicState: AccordionItemState | undefined;

  constructor(local: ItemProps, index: Accessor<number>) {
    this.local = local;
    this.index = index;
    this.root = useAccordionRootContext();
    // A `value` fixed for the item's lifetime never falls back to a generated id, so none is
    // generated. The server and the client decide alike, so hydration ids stay aligned.
    this.fallbackValue =
      isStaticProp(local, 'value') && untrack(() => local.value) !== undefined
        ? undefined
        : useBaseUiId();
    this.publicState = undefined;
    // `open` is always this item's membership in the root's value: there is no mode to decide, so
    // the collapsible root reads it directly.
    this.collapsible = useCollapsibleRoot({
      alwaysControlled: true,
      open: () => this.open(),
      // Solid: a handler reading the latest props is React's stable callback.
      onOpenChange: (nextOpen, eventDetails) => this.onOpenChange(nextOpen, eventDetails),
      disabled: () => this.disabled(),
    });
    this.defaultTriggerId = useBaseUiId();
    // Solid: the trigger clears its registration from an unmount cleanup, so the signal allows
    // owned writes.
    [this.registeredTriggerId, this.setTriggerId] = createSignal<string | null | undefined>(
      undefined,
      { ownedWrite: true },
    );
    this.owner = getOwner();
    this.stateView = new AccordionItemStateView(this);
  }

  value() {
    return this.local.value ?? this.fallbackValue!();
  }

  disabled() {
    return (this.local.disabled ?? false) || this.root.disabled();
  }

  open() {
    return this.root.isOpen(this.value());
  }

  hidden() {
    return !this.open() && !this.collapsible.mounted();
  }

  triggerId() {
    const registered = this.registeredTriggerId();
    return registered === null ? undefined : (registered ?? this.defaultTriggerId());
  }

  onOpenChange(nextOpen: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) {
    this.local.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    this.root.handleValueChange(this.value(), nextOpen, eventDetails);
  }

  /**
   * The state the parts render (`value`, `orientation`, `hidden`, `index`, `disabled`, `open`, read
   * live), as consumer functions and render props receive it. Created on first read.
   */
  get state(): AccordionItemState {
    this.publicState ??= createItemState(this);
    return this.publicState;
  }
}

/** The public state object: own enumerable getters, as consumers spread or inspect it. */
function createItemState(item: AccordionItemModel): AccordionItemState {
  return {
    get value() {
      return item.root.state.value;
    },
    get orientation() {
      return item.root.state.orientation;
    },
    get hidden() {
      return item.hidden();
    },
    get index() {
      return item.index();
    },
    get disabled() {
      return item.disabled();
    },
    get open() {
      return item.open();
    },
  };
}
