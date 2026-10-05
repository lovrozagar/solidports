import { DEFAULT_LABELABLE_CONTEXT } from '../../internals/labelable-provider/LabelableContext';
import type { LabelableContext } from '../../internals/labelable-provider/LabelableContext';
import type { BaseUIHTMLProps } from '../../utils/types';
import { DEFAULT_FIELD_ROOT_CONTEXT, type FieldRootContext } from './FieldRootContext';

/**
 * The description and validation prop sources of a labelable control, for its props list. Outside a
 * `LabelableProvider` the description source only returns its input, and outside a `Field` the
 * validation state is the default (never invalid), so each is left out there: a control without a
 * Field gets no extra props views or memos for them.
 */
export function createFieldPropSources(labelable: LabelableContext, field: FieldRootContext) {
  const hasDescription = labelable !== DEFAULT_LABELABLE_CONTEXT;
  const hasField = field !== DEFAULT_FIELD_ROOT_CONTEXT;
  return <Props>(
    validation: (props: Props) => BaseUIHTMLProps,
  ): Array<(props: Props) => BaseUIHTMLProps> => [
    ...(hasDescription ? [labelable.getDescriptionProps as (props: Props) => BaseUIHTMLProps] : []),
    ...(hasField ? [validation] : []),
  ];
}
