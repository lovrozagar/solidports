import { createEffect } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useLabelableContext } from '../../internals/labelable-provider/LabelableContext';
import { useLabel } from '../../internals/labelable-provider/useLabel';
import { splitComponentProps, useRef } from '../../solid-helpers';
import { canRenderNative, partHandler } from '../../utils/native';
import { compileStateWriter, renderNativeElement } from '../../utils/native/element';
import type { SetAttribute } from '../../utils/native/element';
import type { BaseUIComponentProps, HTMLProps } from '../../utils/types';
import { error } from '../../utils/error';
import { useRenderElement } from '../../utils/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const LABEL = { tag: 'label', create: () => (<label />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['id', 'nativeLabel']);
const writeLabelState = compileStateWriter(['disabled', 'touched', 'dirty', 'valid', 'filled', 'focused'], fieldValidityMapping);

/** The label's attributes, as `useLabel`'s props produce them. */
function writeLabelAttributes(w: SetAttribute, labelProps: HTMLProps) {
  w.set('id', labelProps.id);
  w.set('for', (labelProps as { for?: string | undefined }).for);
}

type LabelHandler = (event: Event) => void;
const forwardTo = (key: 'onMouseDown' | 'onClick' | 'onPointerDown') =>
  partHandler<HTMLProps>(key, (labelProps, event) =>
    (labelProps[key] as unknown as LabelHandler)(event),
  );

const LABEL_HANDLERS = {
  onMouseDown: forwardTo('onMouseDown'),
  onClick: forwardTo('onClick'),
  onPointerDown: forwardTo('onPointerDown'),
};

/**
 * An accessible label that is automatically associated with the field control.
 * Renders a `<label>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldLabel(componentProps: FieldLabel.Props): JSX.Element {
  const local = componentProps;
  // Solid: JSX attribute types allow `false` to remove the attribute; it means unset here.
  const idProp = () => (local.id === false ? undefined : local.id);
  const nativeLabel = () => local.nativeLabel ?? true;

  const fieldRootContext = useFieldRootContext(false);
  const fieldItemContext = useFieldItemContext();
  const { labelId } = useLabelableContext();

  const state: FieldLabelState = solidMergeProps(fieldRootContext.state, {
    get disabled() {
      return Boolean(fieldRootContext.disabled() || fieldItemContext.disabled());
    },
  });

  const labelRef = useRef<HTMLLabelElement | null | undefined>(null);
  const labelProps = useLabel({
    id: () => labelId() ?? idProp(),
    native: nativeLabel,
  });

  if (process.env.NODE_ENV !== 'production') {
    createEffect(nativeLabel, (native) => {
      if (!labelRef.current) {
        return;
      }

      const isLabelTag = labelRef.current.tagName === 'LABEL';

      // Solid: no owner-stack API, so messages carry no component stack.
      if (native) {
        if (!isLabelTag) {
          const message =
            '<Field.Label> expected a <label> element because the `nativeLabel` prop is true. ' +
            'Rendering a non-<label> disables native label association, so `htmlFor` will not ' +
            'work. Use a real <label> in the `render` prop, or set `nativeLabel` to `false`.';
          error(message);
        }
      } else if (isLabelTag) {
        const message =
          '<Field.Label> expected a non-<label> element because the `nativeLabel` prop is false. ' +
          'Rendering a <label> assumes native label behavior while Base UI treats it as ' +
          'non-native, which can cause unexpected pointer behavior. Use a non-<label> in the ' +
          '`render` prop, or set `nativeLabel` to `true`.';
        error(message);
      }
    });
  }

  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<label>` with its id,
  // its control and its handlers, no props view (D32).
  if (canRenderNative(componentProps, undefined, true)) {
    return renderNativeElement(LABEL, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeLabelState,
      mapping: fieldValidityMapping,
      attributes: writeLabelAttributes,
      handlers: LABEL_HANDLERS,
      handlerTarget: labelProps,
      reactive: true,
      refs: [
        (el: HTMLLabelElement | null) => {
          labelRef.current = el;
        },
      ],
    }) as unknown as JSX.Element;
  }

  const [, , elementProps] = splitComponentProps(componentProps, ['id', 'nativeLabel']);

  const element = useRenderElement('label', componentProps, {
    ref: labelRef,
    state,
    props: [labelProps, elementProps],
    stateAttributesMapping: fieldValidityMapping,
  });

  return element();
}

export interface FieldLabelState extends FieldRootState {}

export interface FieldLabelProps extends BaseUIComponentProps<'label', FieldLabelState> {
  /**
   * Whether the component renders a native `<label>` element when replacing it via the `render` prop.
   * Set to `false` if the rendered element is not a label (for example, `<div>`).
   *
   * This is useful to avoid inheriting label behaviors on `<button>` controls (such as `<Select.Trigger>` and `<Combobox.Trigger>`), including avoiding `:hover` on the button when hovering the label, and preventing clicks on the label from firing on the button.
   * @default true
   */
  nativeLabel?: boolean | undefined;
}

export namespace FieldLabel {
  export type State = FieldLabelState;
  export type Props = FieldLabelProps;
}
