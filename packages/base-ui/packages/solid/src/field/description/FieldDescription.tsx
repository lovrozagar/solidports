import { mergeProps as solidMergeProps } from '../../solid-1-compat';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldDescription(componentProps: FieldDescription.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);

  const id = useBaseUiId(() => local.id);

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { registerMessageId } = useLabelableContext();

  const state: FieldDescriptionState = solidMergeProps(fieldRootContext.state, {
    get disabled() {
      return Boolean(fieldRootContext.disabled() || fieldItemContext.disabled());
    },
  });

  registerMessageId(id);

  const element = useRenderElement('p', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    state,
    stateAttributesMapping: fieldValidityMapping,
  });

  return <>{element()}</>;
}

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps extends BaseUIComponentProps<'p', FieldDescriptionState> {}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
