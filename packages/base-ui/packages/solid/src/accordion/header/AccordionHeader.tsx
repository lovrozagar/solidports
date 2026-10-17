import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { writeItemState } from '../item/AccordionItemModel';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';

/** The part has no props of its own. */
/** The header's element: an `<h3>`; the server renders the same tag. */
const H3 = { tag: 'h3', create: () => (<h3 />) as unknown as Element };

const OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * A heading that labels the corresponding panel.
 * Renders an `<h3>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/solid/components/accordion)
 */
export function AccordionHeader(componentProps: AccordionHeader.Props) {
  const item = useAccordionItemContext();

  // Native fast path (`context/architecture/render-pipeline.md`): an `<h3>` rendered with direct JSX,
  // on the client, the server and while hydrating.
  if (canRenderNative(componentProps, undefined, true)) {
     
    return renderNativeElement(H3, componentProps, {
      own: OWN_KEYS,
      state: () => item.state,
      stateView: item.stateView,
      stateWriter: writeItemState,
      mapping: accordionStateAttributesMapping,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('h3', componentProps, {
    props: elementProps,
    state: item.state,
    stateAttributesMapping: accordionStateAttributesMapping,
  });

  return element();
}

export interface AccordionHeaderState extends AccordionItemState {}

export interface AccordionHeaderProps extends BaseUIComponentProps<'h3', AccordionHeaderState> {}

export namespace AccordionHeader {
  export type State = AccordionHeaderState;
  export type Props = AccordionHeaderProps;
}
