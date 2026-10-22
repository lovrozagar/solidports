import { untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isStaticProp, splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { useRegisteredLabelId } from '../../utils/useRegisteredLabelId';
import { useFieldsetRootContext } from '../root/FieldsetRootContext';

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['id']);
const writeLegendState = compileStateWriter(['disabled'], undefined);

/** The legend's registered id: one accessor per legend. */
function writeLegendAttributes(w: SetAttribute, id: Accessor<string | undefined>) {
  w.set('id', id());
}

/**
 * An accessible label that is automatically associated with the fieldset.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetLegend(componentProps: FieldsetLegend.Props): JSX.Element {
  const { disabled, setLegendId } = useFieldsetRootContext();

  // Solid: JSX `id` may be `false` (remove the attribute), which means no explicit id.
  const idProp = () => (componentProps.id === false ? undefined : componentProps.id);
  // A static id needs no memo.
  const id = useRegisteredLabelId(
    isStaticProp(componentProps, 'id') ? untrack(idProp) : idProp,
    setLegendId,
  );

  const state: FieldsetLegend.State = {
    get disabled() {
      return disabled();
    },
  };

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with its
  // registered id, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeLegendState,
      attributes: writeLegendAttributes,
      handlerTarget: id,
      reactive: true,
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['id']);

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

  return element();
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
