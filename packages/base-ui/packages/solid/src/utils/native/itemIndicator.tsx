/*
 * The native item indicator shared by every item kind that shows one (D32's sweep): a
 * `<span aria-hidden>` with the item's state and the transition hooks as `data-*` attributes,
 * rendered through a `NativeConditional`, so the gate costs no node of its own. The transition
 * contract is Checkbox.Indicator's (`createLazyTransitionStatus` with a batched close-complete on
 * the indicator). Each kind is one frozen module-level config: what shows it, whether it stays
 * mounted through its exit transition, its state's getters, its writer and its default children.
 */
import { getOwner } from 'solid-js';
import type { Accessor, Owner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createLazyTransitionStatus } from '../createLazyTransitionStatus';
import type { LazyTransitionHandle } from '../createLazyTransitionStatus';
import { NativeConditional } from './conditional';
import { renderNativeElement } from './element';
import type { NativeElementTemplate, StateWriter } from './element';

export interface NativeItemIndicatorProps {
  keepMounted?: boolean | undefined;
}

/** One item kind's indicator, shared by all of that kind's indicators. */
export interface NativeItemIndicatorKind<Item> {
  /** The item's accessor that shows the indicator (checked, selected). */
  shown: (item: Item) => Accessor<boolean>;
  /**
   * Whether the indicator stays mounted until its exit transition ends (Menu's). Otherwise it
   * unmounts as its item stops showing it, unless `keepMounted`, and each mount gets a transition
   * of its own (upstream's `keepMounted || selected` gate, Select's and Combobox's).
   */
  keepsExit: boolean;
  /** The state view, with prototype getters over the item and the transition. */
  State: new (item: Item, transition: LazyTransitionHandle) => object;
  /** The state's `data-*` attributes, in the slow path's key order. */
  writeState: StateWriter;
  /** The children the indicator shows when the consumer passes none. */
  children?: (() => JSX.Element) | undefined;
}

const SPAN: NativeElementTemplate = {
  tag: 'span',
  attributes: { 'aria-hidden': 'true' },
  create: () => (<span aria-hidden="true" />) as unknown as Element,
};
const OWN_KEYS: ReadonlySet<string> = new Set(['keepMounted']);

const indicatorState = (state: object) => state;

/** One indicator: its gate, its transition and the element its close-complete waits on. */
class NativeItemIndicator<Item> extends NativeConditional<JSX.Element> {
  declare private readonly props: NativeItemIndicatorProps;
  declare private readonly item: Item;
  declare private readonly kind: NativeItemIndicatorKind<Item>;
  declare private readonly itemShows: Accessor<boolean>;
  declare private transition: LazyTransitionHandle | undefined;
  declare indicator: HTMLElement | null;

  constructor(
    owner: Owner | null,
    props: NativeItemIndicatorProps,
    item: Item,
    kind: NativeItemIndicatorKind<Item>,
  ) {
    super(owner);
    this.props = props;
    this.item = item;
    this.kind = kind;
    this.itemShows = kind.shown(item);
    this.indicator = null;
    this.transition = kind.keepsExit ? this.createTransition() : undefined;
  }

  shouldRender(): boolean {
    if (this.props.keepMounted ?? false) {
      return true;
    }
    return this.kind.keepsExit ? this.transition!.mounted() : this.itemShows();
  }

  render(): JSX.Element {
    const transition = this.kind.keepsExit ? this.transition! : this.createTransition();
    const children = 'children' in this.props ? undefined : this.kind.children;
    const view = new this.kind.State(this.item, transition);
    return renderNativeElement(SPAN, this.props, {
      own: OWN_KEYS,
      state: indicatorState,
      stateWriter: this.kind.writeState,
      stateView: view,
      reactive: true,
      handlerTarget: view,
      refs: [this.setIndicator.bind(this)],
      ...(children ? { children } : {}),
    }) as unknown as JSX.Element;
  }

  private createTransition() {
    return createLazyTransitionStatus(this.itemShows, {
      closeComplete: { batch: true, ref: () => this.indicator },
    });
  }

  private setIndicator(node: HTMLElement | null) {
    this.indicator = node;
  }
}

/** Renders `kind`'s indicator natively for `props`, reading its item from `item`. */
export function renderNativeItemIndicator<Item>(
  props: NativeItemIndicatorProps,
  item: Item,
  kind: NativeItemIndicatorKind<Item>,
): JSX.Element {
  return new NativeItemIndicator(
    getOwner(),
    props,
    item,
    kind,
  ).accessor() as unknown as JSX.Element;
}
