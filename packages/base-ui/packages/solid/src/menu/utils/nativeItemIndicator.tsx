/*
 * The native path shared by Menu's CheckboxItemIndicator and RadioItemIndicator (D32's sweep): a
 * `<span aria-hidden>` mounted while its item is checked (or `keepMounted`), with the item's
 * state and the transition hooks as `data-*` attributes. The mount and transition contract is
 * Checkbox.Indicator's (`createLazyTransitionStatus` with a batched close-complete on the
 * indicator), so an unchecked indicator builds no transition machinery until its item is first
 * checked. Checkbox.Indicator's own element writes the checkbox root's state (indeterminate, the
 * Field validity, read-only, required), so only the lazy transition is shared with it.
 */
import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { createLazyTransitionStatus } from '../../utils/createLazyTransitionStatus';
import type { LazyTransitionHandle } from '../../utils/createLazyTransitionStatus';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate } from '../../utils/native/element';
import type { TransitionStatus } from '../../utils/useTransitionStatus';
import { itemMapping } from './stateAttributesMapping';

/** What an indicator reads from its item's context (the native item's model or the slow value). */
export interface ItemIndicatorSource {
  checked: Accessor<boolean>;
  disabled: Accessor<boolean>;
  highlighted: Accessor<boolean>;
}

export interface NativeItemIndicatorProps {
  keepMounted?: boolean | undefined;
}

const SPAN: NativeElementTemplate = {
  tag: 'span',
  attributes: { 'aria-hidden': 'true' },
  create: () => (<span aria-hidden="true" />) as unknown as Element,
};
const OWN_KEYS: ReadonlySet<string> = new Set(['keepMounted']);
/** The indicator state's `data-*` attributes in the slow path's key order. */
const writeIndicatorState = compileStateWriter(
  ['checked', 'disabled', 'highlighted', 'transitionStatus'],
  itemMapping,
);

/** The indicator's state: prototype getters over its item and its transition. */
class NativeItemIndicatorState {
  declare private readonly item: ItemIndicatorSource;
  declare private readonly transition: LazyTransitionHandle;
  declare indicator: HTMLElement | null;

  constructor(item: ItemIndicatorSource, transition: LazyTransitionHandle) {
    this.item = item;
    this.transition = transition;
    this.indicator = null;
  }

  get checked() {
    return this.item.checked();
  }

  get disabled() {
    return this.item.disabled();
  }

  get highlighted() {
    return this.item.highlighted();
  }

  get transitionStatus(): TransitionStatus {
    return this.transition.transitionStatus();
  }
}

const indicatorState = (state: NativeItemIndicatorState) => state;

/** Renders an item indicator natively for `props`, reading its item from `item`. */
export function renderNativeItemIndicator(
  props: NativeItemIndicatorProps,
  item: ItemIndicatorSource,
): JSX.Element {
  let state: NativeItemIndicatorState | undefined;
  const transition = createLazyTransitionStatus(item.checked, {
    closeComplete: { batch: true, ref: () => state?.indicator },
  });
  state = new NativeItemIndicatorState(item, transition);
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
          stateWriter: writeIndicatorState,
          stateView: view,
          reactive: true,
          handlerTarget: view,
          refs: [setIndicator],
        }) as unknown as JSX.Element
      }
    </Show>
  );
}
