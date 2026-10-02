import { LabelableProvider } from '../../internals/labelable-provider';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';
import { FieldItemContext } from './FieldItemContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldItem(componentProps: FieldItem.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled']);

  const disabledProp = () => local.disabled ?? false;

  const { state: fieldState, disabled: rootDisabled } = useFieldRootContext(false);

  const disabled = () => Boolean(rootDisabled() || disabledProp());
  const state: FieldItemState = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
  });

  const fieldItemContext: FieldItemContext = { disabled };

  const element = useRenderElement('div', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping: fieldValidityMapping,
  });

  return (
    <LabelableProvider>
      <FieldItemContext value={fieldItemContext}>{element()}</FieldItemContext>
    </LabelableProvider>
  );
}

export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps extends BaseUIComponentProps<'div', FieldItemState> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props = FieldItemProps;
}
