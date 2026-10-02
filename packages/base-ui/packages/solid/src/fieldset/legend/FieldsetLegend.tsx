import { createTrackedEffect, onCleanup } from 'solid-js';
import { splitComponentProps } from '../../solid-helpers';
import type { BaseUIComponentProps } from '../../utils/types';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useRenderElement } from '../../utils/useRenderElement';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetLegend(componentProps: FieldsetLegend.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['id']);
  const idProp = () => local.id;

  const { disabled, setLegendId } = useFieldsetRootContext();

  const id = useBaseUiId(idProp);

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    setLegendId(id());
    _c.push(() => {
      setLegendId(undefined);
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  const state: FieldsetLegend.State = {
    get disabled() {
      return disabled() ?? false;
    },
  };

  const element = useRenderElement('div', componentProps, {
    props: [
      {
        get id() {
          return id();
        },
      },
      elementProps,
    ],
    state,
  });

  return <>{element()}</>;
}

export interface FieldsetLegendState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
}

export interface FieldsetLegendProps extends BaseUIComponentProps<'div', FieldsetLegend.State> {}

export namespace FieldsetLegend {
  export type State = FieldsetLegendState;
  export type Props = FieldsetLegendProps;
}
