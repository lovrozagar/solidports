import { createEffect } from 'solid-js';
import type { Setter } from 'solid-js';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { fieldValidityMapping } from '../../field/utils/constants';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { splitComponentProps } from '../../solid-helpers';
import { error } from '../../utils/error';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

/**
 * An accessible label that is automatically associated with the combobox trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Combobox](https://base-ui.com/react/components/combobox)
 */
export function ComboboxLabel(componentProps: ComboboxLabel.Props) {
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const [, , elementProps] = splitComponentProps(
    componentProps as ComboboxLabel.Props & { id?: string | undefined },
    ['id'],
  );

  const fieldRootContext = useFieldRootContext();
  const store = useComboboxRootContext();

  const inputInsidePopup = store.useState('inputInsidePopup');
  const triggerElement = store.useState('triggerElement');
  const inputElement = store.useState('inputElement');
  const rootId = store.useState('id');
  const defaultLabelId = () => getDefaultLabelId(rootId());

  const localControlId = () => triggerElement()?.id ?? (inputInsidePopup() ? rootId() : undefined);

  if (process.env.NODE_ENV !== 'production') {
    createEffect(
      () => ({ inputElement: inputElement(), inputInsidePopup: inputInsidePopup() }),
      (deps) => {
        if (!deps.inputElement || deps.inputInsidePopup) {
          return;
        }

        error(
          '<Combobox.Label> labels <Combobox.Trigger> only. ' +
            'When <Combobox.Input> is the form control, use a native <label> or <Field.Label> instead.',
        );
      },
    );
  }

  function setLabelId(
    nextLabelId: string | undefined | ((prev: string | undefined) => string | undefined),
  ) {
    const resolvedLabelId =
      typeof nextLabelId === 'function' ? nextLabelId(store.state.labelId) : nextLabelId;
    store.set('labelId', resolvedLabelId);
    return resolvedLabelId;
  }

  const labelProps = useLabel({
    id: defaultLabelId,
    fallbackControlId: localControlId,
    setLabelId: setLabelId as Setter<string | undefined>,
  });

  const element = useRenderElement('div', componentProps, {
    state: fieldRootContext.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });

  return <>{element()}</>;
}

export type ComboboxLabelState = FieldRoot.State;

export interface ComboboxLabelProps extends Omit<
  BaseUIComponentProps<'div', ComboboxLabelState>,
  'id'
> {}

export namespace ComboboxLabel {
  export type State = ComboboxLabelState;
  export type Props = ComboboxLabelProps;
}
