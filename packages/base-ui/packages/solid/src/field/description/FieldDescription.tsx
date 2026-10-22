import { untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';
import { isStaticProp, splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';

const P = { tag: 'p', create: () => (<p />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['id']);
const writeDescriptionState = compileStateWriter(['disabled', 'touched', 'dirty', 'valid', 'filled', 'focused'], fieldValidityMapping);

function writeDescriptionAttributes(w: SetAttribute, id: Accessor<string | undefined>) {
  w.set('id', id());
}

/**
 * A paragraph with additional information about the field.
 * Renders a `<p>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldDescription(componentProps: FieldDescription.Props): JSX.Element {
  // A static id needs no memo.
  const id = useBaseUiId(
    isStaticProp(componentProps, 'id')
      ? untrack(() => componentProps.id)
      : () => componentProps.id,
  );

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { registerMessageId } = useLabelableContext();

  const state: FieldDescriptionState = solidMergeProps(fieldRootContext.state, {
    get disabled() {
      return Boolean(fieldRootContext.disabled() || fieldItemContext.disabled());
    },
  });

  registerMessageId(id);

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<p>` with its id and the
  // field's state attributes, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(P, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeDescriptionState,
      mapping: fieldValidityMapping,
      attributes: writeDescriptionAttributes,
      handlerTarget: id,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['id']);

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

  return element();
}

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps extends BaseUIComponentProps<'p', FieldDescriptionState> {}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
