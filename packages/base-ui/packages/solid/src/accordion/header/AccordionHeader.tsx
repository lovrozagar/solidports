import { splitComponentProps } from '../../solid-helpers';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';

/**
 * A heading that labels the corresponding panel.
 * Renders an `<h3>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/solid/components/accordion)
 */
export function AccordionHeader(componentProps: AccordionHeader.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { state } = useAccordionItemContext();

  const element = useRenderElement('h3', componentProps, {
    props: elementProps,
    state,
    stateAttributesMapping: accordionStateAttributesMapping,
  });

  return <>{element()}</>;
}

export interface AccordionHeaderState extends AccordionItemState {}

export interface AccordionHeaderProps extends BaseUIComponentProps<'h3', AccordionHeaderState> {}

export namespace AccordionHeader {
  export type State = AccordionHeaderState;
  export type Props = AccordionHeaderProps;
}
