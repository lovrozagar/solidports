import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetLegend(componentProps: FieldsetLegend.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);

  const { disabled, setLegendId } = useFieldsetRootContext();

  // Solid: JSX `id` may be `false` (remove the attribute), which means no explicit id.
  const id = useRegisteredLabelId(() => (local.id === false ? undefined : local.id), setLegendId);

  const state: FieldsetLegend.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('div', componentProps, {
    state,
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
  });

  return <>{element()}</>;
}

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendProps extends BaseUIComponentProps<'div', FieldsetLegendState> {}

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props = FieldsetLegendProps;
}
