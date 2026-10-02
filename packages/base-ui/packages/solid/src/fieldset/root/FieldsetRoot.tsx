import { createSignal } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { FieldsetRootContext, useFieldsetRootContext } from './FieldsetRootContext';

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetRoot(componentProps: FieldsetRoot.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled']);
  const disabledProp = () => Boolean(local.disabled);

  const [legendId, setLegendId] = createSignal<string | undefined>(undefined);

  const parentContext = useFieldsetRootContext(true);
  const disabled = () => (parentContext?.disabled() ?? false) || disabledProp();

  const state: FieldsetRoot.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('fieldset', componentProps, {
    state,
    props: [
      {
        get 'aria-labelledby'() {
          return legendId();
        },
        get disabled() {
          return disabled();
        },
      },
      elementProps,
    ],
  });

  const contextValue: FieldsetRootContext = {
    legendId,
    setLegendId,
    disabled,
  };

  return <FieldsetRootContext value={contextValue}>{element()}</FieldsetRootContext>;
}

export interface FieldsetRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetRootProps extends BaseUIComponentProps<'fieldset', FieldsetRootState> {}

export namespace FieldsetRoot {
  export type State = FieldsetRootState;
  export type Props = FieldsetRootProps;
}
