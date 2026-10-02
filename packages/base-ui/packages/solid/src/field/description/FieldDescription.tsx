import { createTrackedEffect, onCleanup } from 'solid-js';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { FieldRoot } from '../root/FieldRoot';
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
  const { setMessageIds } = useLabelableContext();

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    const idValue = id();
    if (!idValue) {
      return;
    }

    setMessageIds((v) => v.concat(idValue));

    _c.push(() => {
      setMessageIds((v) => v.filter((item) => item !== idValue));
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const element = useRenderElement('p', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    state: fieldRootContext.state,
    stateAttributesMapping: fieldValidityMapping,
  });

  return <>{element()}</>;
}

export type FieldDescriptionState = FieldRoot.State;

export interface FieldDescriptionProps extends BaseUIComponentProps<'p', FieldDescription.State> {}

export namespace FieldDescription {
  export type State = FieldDescriptionState;
  export type Props = FieldDescriptionProps;
}
