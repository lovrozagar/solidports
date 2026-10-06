import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { AccordionItemState } from '../item/AccordionItem';
import { useAccordionItemContext } from '../item/AccordionItemContext';
import { accordionStateAttributesMapping } from '../item/stateAttributesMapping';

/** The part has no props of its own. */
const OWN_KEYS: ReadonlySet<string> = new Set();

/**
 * A heading that labels the corresponding panel.
 * Renders an `<h3>` element.
 *
 * Documentation: [Base UI Accordion](https://base-ui.com/solid/components/accordion)
 */
export function AccordionHeader(componentProps: AccordionHeader.Props) {
  const { state } = useAccordionItemContext();

  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): an `<h3>` rendered with direct JSX.
  if (canRenderNative(componentProps)) {
    return renderNativeElement((<h3 />) as unknown as Element, componentProps, {
      own: OWN_KEYS,
      state,
      mapping: accordionStateAttributesMapping,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

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
