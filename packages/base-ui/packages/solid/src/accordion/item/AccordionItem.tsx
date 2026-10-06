/* eslint-disable typescript/no-explicit-any -- `value` is `any`, mirrors React */
import { createMemo, createSignal, getOwner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import type { CollapsibleRoot, CollapsibleRootState } from '../../collapsible/root/CollapsibleRoot';
import { CollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useCollapsibleRoot } from '../../collapsible/root/useCollapsibleRoot';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import { type BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { canRenderNative } from '../../utils/native';
import { provideNativeContexts } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import { REASONS } from '../../utils/reasons';
import { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionRootState } from '../root/AccordionRoot';
import { useAccordionRootContext } from '../root/AccordionRootContext';
import { AccordionItemContext } from './AccordionItemContext';
import { accordionStateAttributesMapping } from './stateAttributesMapping';

/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'onOpenChange', 'value']);
/** Items rendered in DOM order get their index on the first render (the list's flush confirms it). */
const GUESS_INDEX = { guessIndex: true };

/**
 * Groups an accordion header with the corresponding panel.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/solid/components/accordion)
 */
export function AccordionItem(componentProps: AccordionItem.Props): JSX.Element {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a `<div>` rendered with direct
  // JSX, its two contexts on plain owners and a lean list registration.
  if (canRenderNative(componentProps)) {
    const listItem = createNativeListItem<null>(null, GUESS_INDEX);
    const item = createAccordionItem(componentProps, listItem.index);
    return provideNativeContexts(
      CollapsibleRootContext,
      item.collapsibleContext,
      AccordionItemContext,
      item.accordionItemContext,
      () =>
        renderNativeElement((<div />) as unknown as Element, componentProps, {
          own: OWN_KEYS,
          state: item.state,
          mapping: accordionStateAttributesMapping,
          reactive: true,
          refs: [listItem.setRef],
        }),
    ) as unknown as JSX.Element;
  }

  const [, local, elementProps] = splitComponentProps(componentProps, [
    'disabled',
    'onOpenChange',
    'value',
  ]);

  const { setRef: listItemRef, index } = useCompositeListItem();
  const item = createAccordionItem(local, index);

  const element = useRenderElement('div', componentProps, {
    state: item.state,
    ref: listItemRef,
    props: elementProps,
    stateAttributesMapping: accordionStateAttributesMapping,
  });

  return provideContext(CollapsibleRootContext, item.collapsibleContext, () =>
    provideContext(AccordionItemContext, item.accordionItemContext, element),
  );
}

/** The item's open state, collapsible root and contexts, shared by both render paths. */
function createAccordionItem(
  local: Pick<AccordionItem.Props, 'disabled' | 'onOpenChange' | 'value'>,
  index: () => number,
) {
  const {
    disabled: contextDisabled,
    handleValueChange,
    state: rootState,
    value: openValues,
  } = useAccordionRootContext();

  const fallbackValue = useBaseUiId();

  const value = () => local.value ?? fallbackValue();

  const disabled = () => (local.disabled ?? false) || contextDisabled();

  const isOpen = createMemo(() => openValues().indexOf(value()) !== -1);

  // Solid: a handler reading the latest props is React's stable callback.
  const onOpenChange = (nextOpen: boolean, eventDetails: CollapsibleRoot.ChangeEventDetails) => {
    local.onOpenChange?.(nextOpen, eventDetails);

    if (eventDetails.isCanceled) {
      return;
    }

    handleValueChange(value(), nextOpen, eventDetails);
  };

  // `open` is always this item's membership in the root's value: `useControlled` has no mode to
  // decide, so the collapsible root reads it directly.
  const collapsible = useCollapsibleRoot({
    alwaysControlled: true,
    open: isOpen,
    onOpenChange,
    disabled,
  });

  const collapsibleState: CollapsibleRootState = {
    get open() {
      return collapsible.open();
    },
    get disabled() {
      return collapsible.disabled();
    },
    get transitionStatus() {
      return collapsible.transitionStatus();
    },
  };

  const collapsibleContext: CollapsibleRootContext = {
    ...collapsible,
    onOpenChange,
    state: collapsibleState,
  };

  const state: AccordionItemState = {
    get value() {
      return rootState.value;
    },
    get orientation() {
      return rootState.orientation;
    },
    get hidden() {
      return !isOpen() && !collapsible.mounted();
    },
    get index() {
      return index();
    },
    get disabled() {
      return disabled();
    },
    get open() {
      return isOpen();
    },
  };

  const defaultTriggerId = useBaseUiId();
  // `undefined` uses the initial generated fallback; `null` means the trigger unmounted.
  // Solid: the trigger clears its registration from an unmount cleanup, so the signal allows owned writes.
  const [registeredTriggerId, setTriggerId] = createSignal<string | null | undefined>(undefined, {
    ownedWrite: true,
  });
  const triggerId = () => {
    const registered = registeredTriggerId();
    return registered === null ? undefined : (registered ?? defaultTriggerId());
  };

  const accordionItemContext: AccordionItemContext = {
    defaultTriggerId,
    open: isOpen,
    owner: getOwner(),
    state,
    setTriggerId,
    triggerId,
  };

  return { accordionItemContext, collapsibleContext, state };
}

export interface AccordionItemState extends AccordionRootState {
  /**
   * Whether the accordion item's panel is currently hidden.
   */
  hidden: boolean;
  /**
   * The item index.
   */
  index: number;
  /**
   * Whether the component is open.
   */
  open: boolean;
}

export interface AccordionItemProps extends BaseUIComponentProps<'div', AccordionItemState> {
  /**
   * Whether the component should ignore user interaction.
   * @default false
   */
  // Solid: declared here because the hook parameter accepts an accessor.
  disabled?: boolean | undefined;
  /**
   * A unique value that identifies this accordion item.
   * If no value is provided, a unique ID will be generated automatically.
   * Use when controlling the accordion programmatically, or to set an initial
   * open state.
   * @example
   * ```tsx
   * <Accordion.Root value={['a']}>
   *   <Accordion.Item value="a" /> // initially open
   *   <Accordion.Item value="b" /> // initially closed
   * </Accordion.Root>
   * ```
   */
  value?: any;
  /**
   * Event handler called when the panel is opened or closed.
   */
  onOpenChange?:
    ((open: boolean, eventDetails: AccordionItem.ChangeEventDetails) => void) | undefined;
}

export type AccordionItemChangeEventReason = typeof REASONS.triggerPress | typeof REASONS.none;

export type AccordionItemChangeEventDetails =
  BaseUIChangeEventDetails<AccordionItem.ChangeEventReason>;

export namespace AccordionItem {
  export type State = AccordionItemState;
  export type Props = AccordionItemProps;
  export type ChangeEventReason = AccordionItemChangeEventReason;
  export type ChangeEventDetails = AccordionItemChangeEventDetails;
}
