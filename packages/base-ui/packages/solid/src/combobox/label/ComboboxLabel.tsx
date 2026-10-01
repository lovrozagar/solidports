import { createEffect, onCleanup, splitProps } from 'solid-js';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { fieldValidityMapping } from '../../field/utils/constants';
import { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxLabel(componentProps: ComboboxLabel.Props) {
  /* Strip id — label id is always derived from the root id, not consumer-supplied.
   * Cast to include id so splitProps can remove it even from untyped callers. */
  const [, elementProps] = splitProps(componentProps as ComboboxLabel.Props & { id?: string }, [
    'id',
  ]);

  const fieldRootContext = useFieldRootContext();
  const { store } = useComboboxRootContext();
  const { setLabelId } = useLabelableContext();

  const rootId = store.useSelector('id');
  const defaultLabelId = () => getDefaultLabelId(rootId());

  createEffect(() => {
    const id = defaultLabelId();
    if (id) {
      setLabelId(id);
    }
    onCleanup(() => {
      setLabelId(undefined);
    });
  });

  const element = useRenderElement('div', componentProps, {
    get props() {
      return [{ id: defaultLabelId() }, elementProps];
    },
    state: fieldRootContext.state,
    stateAttributesMapping: fieldValidityMapping,
  });

  return <>{element()}</>;
}

export type ComboboxLabelState = FieldRoot.State;

export interface ComboboxLabelProps
  extends Omit<BaseUIComponentProps<'div', ComboboxLabel.State>, 'id'> {}

export namespace ComboboxLabel {
  export type State = ComboboxLabelState;
  export type Props = ComboboxLabelProps;
}
