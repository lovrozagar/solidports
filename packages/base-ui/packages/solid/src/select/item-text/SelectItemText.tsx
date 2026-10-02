import { createEffect } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useSelectItemContext } from '../item/SelectItemContext';
import { useSelectRootContext } from '../root/SelectRootContext';

/**
 * A text label of the select item.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectItemText(componentProps: SelectItemText.Props) {
  const [, , elementProps] = splitComponentProps(componentProps, []);

  const { index, textRef, selectedByFocus } = useSelectItemContext();
  const { firstItemTextRef, selectedItemTextRef } = useSelectRootContext();

  let node: HTMLElement | null | undefined = null;

  // Solid: refs are applied once, so React's ref callback (keyed on `index`/`selectedByFocus`)
  // re-runs as an effect when either changes.
  createEffect(
    () => ({ index: index(), selectedByFocus: selectedByFocus() }),
    (deps) => {
      if (!node) {
        return;
      }

      if (deps.index === 0) {
        firstItemTextRef.current = node;
      }
      if (deps.selectedByFocus) {
        selectedItemTextRef.current = node;
      }
    },
  );

  const element = useRenderElement('div', componentProps, {
    props: elementProps,
    ref: (el) => {
      node = el;
      textRef.current = el;
    },
  });

  return <>{element()}</>;
}

export interface SelectItemTextState {}

export interface SelectItemTextProps extends BaseUIComponentProps<'div', SelectItemText.State> {}

export namespace SelectItemText {
  export type State = SelectItemTextState;
  export type Props = SelectItemTextProps;
}
