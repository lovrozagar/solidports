/*
 * The native item indicator shared by every item kind that shows one (D32's sweep): a
 * `<span aria-hidden>` mounted while its item shows it (or `keepMounted`), with the item's state
 * and the transition hooks as `data-*` attributes. The mount and transition contract is
 * Checkbox.Indicator's (`createLazyTransitionStatus` with a batched close-complete on the
 * indicator), so a hidden indicator builds no transition machinery until its item first shows it.
 * Each kind is one frozen module-level config: what opens it, its state's getters and its writer.
 */
import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createLazyTransitionStatus } from '../createLazyTransitionStatus';
import type { LazyTransitionHandle } from '../createLazyTransitionStatus';
import { renderNativeElement } from './element';
import type { NativeElementTemplate, StateWriter } from './element';

export interface NativeItemIndicatorProps {
  keepMounted?: boolean | undefined;
}

/** An indicator's state view: the kind's getters over its item and transition, and its element. */
export interface NativeItemIndicatorState {
  indicator: HTMLElement | null;
}

/** One item kind's indicator, shared by all of that kind's indicators. */
export interface NativeItemIndicatorKind<Item> {
  /** The item's accessor that shows the indicator (checked, selected). */
  shown: (item: Item) => Accessor<boolean>;
  /** The state view, with prototype getters over the item and the transition. */
  State: new (item: Item, transition: LazyTransitionHandle) => NativeItemIndicatorState;
  /** The state's `data-*` attributes, in the slow path's key order. */
  writeState: StateWriter;
}

const SPAN: NativeElementTemplate = {
  tag: 'span',
  attributes: { 'aria-hidden': 'true' },
  create: () => (<span aria-hidden="true" />) as unknown as Element,
};
const OWN_KEYS: ReadonlySet<string> = new Set(['keepMounted']);

const indicatorState = (state: NativeItemIndicatorState) => state;

/** Renders `kind`'s indicator natively for `props`, reading its item from `item`. */
export function renderNativeItemIndicator<Item>(
  props: NativeItemIndicatorProps,
  item: Item,
  kind: NativeItemIndicatorKind<Item>,
): JSX.Element {
  let state: NativeItemIndicatorState | undefined;
  const transition = createLazyTransitionStatus(kind.shown(item), {
    closeComplete: { batch: true, ref: () => state?.indicator },
  });
  state = new kind.State(item, transition);
  const view = state;
  const setIndicator = (node: HTMLElement | null) => {
    view.indicator = node;
  };
  return (
    <Show when={(props.keepMounted ?? false) || transition.mounted()}>
      {
        renderNativeElement(SPAN, props, {
          own: OWN_KEYS,
          state: indicatorState,
          stateWriter: kind.writeState,
          stateView: view,
          reactive: true,
          handlerTarget: view,
          refs: [setIndicator],
        }) as unknown as JSX.Element
      }
    </Show>
  );
}
