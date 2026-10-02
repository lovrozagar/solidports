import type { Setter } from 'solid-js';
import type { FieldRoot } from '../../field/root/FieldRoot';
import { useFieldRootContext } from '../../field/root/FieldRootContext';
import { fieldValidityMapping } from '../../field/utils/constants';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { splitComponentProps } from '../../solid-helpers';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useSelectRootContext } from '../root/SelectRootContext';

/**
 * An accessible label that is automatically associated with the select trigger.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Select](https://base-ui.com/react/components/select)
 */
export function SelectLabel(componentProps: SelectLabel.Props) {
  // Keep label id derived from the root and ignore runtime `id` overrides from untyped consumers.
  const [, , elementProps] = splitComponentProps(
    componentProps as SelectLabel.Props & { id?: string | undefined },
    ['id'],
  );

  const fieldRootContext = useFieldRootContext();
  const { store } = useSelectRootContext();

  const triggerElement = store.useState('triggerElement');
  const rootId = store.useState('id');
  const defaultLabelId = () => getDefaultLabelId(rootId());

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
    fallbackControlId: () => triggerElement()?.id ?? rootId(),
    setLabelId: setLabelId as Setter<string | undefined>,
  });

  const element = useRenderElement('div', componentProps, {
    state: fieldRootContext.state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });

  return <>{element()}</>;
}

export type SelectLabelState = FieldRoot.State;

export interface SelectLabelProps extends Omit<
  BaseUIComponentProps<'div', SelectLabel.State>,
  'id'
> {}

export namespace SelectLabel {
  export type State = SelectLabelState;
  export type Props = SelectLabelProps;
}
