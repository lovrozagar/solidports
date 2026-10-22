import type { JSX } from '@solidjs/web';
import { splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { renderNativeElement } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { NumberFieldRoot } from '../root/NumberFieldRoot';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { stateAttributesMapping, writeNumberFieldState } from '../utils/stateAttributesMapping';

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set();
const GROUP_LITERAL = { role: 'group' };

/**
 * Groups the input with the increment and decrement buttons.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Number Field](https://base-ui.com/react/components/number-field)
 */
export function NumberFieldGroup(componentProps: NumberFieldGroup.Props): JSX.Element {
  const { state } = useNumberFieldRootContext();

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div role="group">` with
  // the field's state attributes, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeNumberFieldState,
      mapping: stateAttributesMapping,
      literal: GROUP_LITERAL,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, []);

  const element = useRenderElement('div', componentProps, {
    props: [{ role: 'group' }, elementProps],
    state,
    stateAttributesMapping,
  });

  return element();
}

export interface NumberFieldGroupState extends NumberFieldRoot.State {}

export interface NumberFieldGroupProps extends BaseUIComponentProps<
  'div',
  NumberFieldGroup.State
> {}

export namespace NumberFieldGroup {
  export type State = NumberFieldGroupState;
  export type Props = NumberFieldGroupProps;
}
