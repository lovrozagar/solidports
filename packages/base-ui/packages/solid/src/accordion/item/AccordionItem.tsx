import type { JSX } from '@solidjs/web';
import { CollapsibleRootContext } from '../../collapsible/root/CollapsibleRootContext';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import type { BaseUIChangeEventDetails } from '../../utils/createBaseUIEventDetails';
import { canRenderNative } from '../../utils/native';
import { provideNativeContexts } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import { createNativeListItem } from '../../utils/native/listItem';
import type { REASONS } from '../../utils/reasons';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionRootState } from '../root/AccordionRoot';
import { AccordionItemContext } from './AccordionItemContext';
import { AccordionItemModel, writeItemState } from './AccordionItemModel';
import { accordionStateAttributesMapping } from './stateAttributesMapping';

/** The part's own props: never forwarded to the element. */
/** The item's element: a `<div>`; the server renders the same tag. */
const ITEM_DIV = { tag: 'div', create: () => (<div />) as unknown as Element };

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
  // Native fast path (`context/architecture/render-pipeline.md`): a `<div>` rendered with direct
  // JSX, its two contexts on plain owners and a lean list registration, on the client, the server
  // and while hydrating.
  if (canRenderNative(componentProps, undefined, true)) {
    const listItem = createNativeListItem<null>(null, GUESS_INDEX);
    const item = new AccordionItemModel(componentProps, listItem.index);
    return provideNativeContexts(
      CollapsibleRootContext,
      item.collapsible,
      AccordionItemContext,
      item,
      () =>
        renderNativeElement(ITEM_DIV, componentProps, {
          own: OWN_KEYS,
          state: () => item.state,
          stateView: item.stateView,
          stateWriter: writeItemState,
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
  const item = new AccordionItemModel(local, index);

  const element = useRenderElement('div', componentProps, {
    state: item.state,
    ref: listItemRef,
    props: elementProps,
    stateAttributesMapping: accordionStateAttributesMapping,
  });

  return provideContext(CollapsibleRootContext, item.collapsible, () =>
    provideContext(AccordionItemContext, item, element),
  );
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
