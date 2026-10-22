import { createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitComponentProps, provideContext } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { FieldsetRootContext, useFieldsetRootContext } from './FieldsetRootContext';

const FIELDSET = { tag: 'fieldset', create: () => (<fieldset />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled']);
const writeFieldsetState = compileStateWriter(['disabled'], undefined);

function writeFieldsetAttributes(w: SetAttribute, context: FieldsetRootContext) {
  w.set('aria-labelledby', context.legendId());
  w.set('disabled', context.disabled() ? true : undefined);
}

/**
 * Groups a shared legend with related controls.
 * Renders a `<fieldset>` element.
 *
 * Documentation: [Base UI Fieldset](https://base-ui.com/react/components/fieldset)
 */
export function FieldsetRoot(componentProps: FieldsetRoot.Props): JSX.Element {
  const disabledProp = () => Boolean(componentProps.disabled);

  // Solid: `ownedWrite` because the legend unregisters from its unmount cleanup.
  const [legendId, setLegendId] = createSignal<string | undefined>(undefined, { ownedWrite: true });

  const parentContext = useFieldsetRootContext(true);
  const disabled = () => (parentContext?.disabled() ?? false) || disabledProp();

  const state: FieldsetRoot.State = {
    get disabled() {
      return disabled();
    },
  };

  const contextValue: FieldsetRootContext = {
    legendId,
    setLegendId,
    disabled,
  };

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<fieldset>` with its
  // legend's id and disabled state, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return provideNativeContext(FieldsetRootContext, contextValue, () =>
      renderNativeElement(FIELDSET, componentProps, {
        own: OWN_KEYS,
        state,
        stateWriter: writeFieldsetState,
        attributes: writeFieldsetAttributes,
        handlerTarget: contextValue,
        reactive: true,
      }),
    ) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['disabled']);

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

  return provideContext(FieldsetRootContext, contextValue, element);
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
