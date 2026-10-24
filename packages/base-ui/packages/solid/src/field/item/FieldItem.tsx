import { createComponent } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { LabelableProvider } from '../../internals/labelable-provider';
import { provideContext, splitComponentProps } from '../../solid-helpers';
import { canRenderNative } from '../../utils/native';
import { provideNativeContext } from '../../utils/native/context';
import { renderNativeElement } from '../../utils/native/element';
import type { NativeElementTemplate } from '../../utils/native/element';
import type { BaseUIComponentProps } from '../../utils/types';
import { useRenderElement } from '../../utils/useRenderElement';
import { writeFieldState } from '../root/FieldRoot';
import type { FieldRootState } from '../root/FieldRoot';
import { useFieldRootContext } from '../root/FieldRootContext';
import { fieldValidityMapping } from '../utils/constants';
import { FieldItemContext } from './FieldItemContext';
import { mergeProps as solidMergeProps } from '../../solid-1-compat';

const DIV: NativeElementTemplate = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled']);

/**
 * Groups individual items in a checkbox group or radio group with a label and description.
 * Renders a `<div>` element.
 *
 * Documentation: [Base UI Field](https://base-ui.com/react/components/field)
 */
export function FieldItem(componentProps: FieldItem.Props): JSX.Element {
  // Native fast path (`context/architecture/render-pipeline.md`): a plain `<div>` with the
  // field's state and the item's `disabled`, on the client, the server and while hydrating (D32).
  // The props pass through as they are: a JSX spread would make them a proxy.
  if (canRenderNative(componentProps, undefined, true)) {
    return createComponent(LabelableProvider, {
      get children() {
        return createComponent(NativeFieldItem, componentProps);
      },
    });
  }
  return SlowFieldItem(componentProps);
}

function SlowFieldItem(componentProps: FieldItem.Props) {
  const [, local, elementProps] = splitComponentProps(componentProps, ['disabled']);

  const disabledProp = () => local.disabled ?? false;

  const { state: fieldState, disabled: rootDisabled } = useFieldRootContext(false);

  const disabled = () => Boolean(rootDisabled() || disabledProp());
  const state: FieldItemState = solidMergeProps(fieldState, {
    get disabled() {
      return disabled();
    },
  });

  const fieldItemContext: FieldItemContext = { disabled };

  const element = useRenderElement('div', componentProps, {
    state,
    props: elementProps,
    stateAttributesMapping: fieldValidityMapping,
  });

  return (
    <LabelableProvider>
      {provideContext(FieldItemContext, fieldItemContext, () => (
        <>{element()}</>
      ))}
    </LabelableProvider>
  );
}

/** The item's state: the field's, with the item's own `disabled` (prototype getters). */
class NativeFieldItemState {
  declare private readonly field: FieldRootState;
  declare private readonly isDisabled: Accessor<boolean>;

  constructor(field: FieldRootState, disabled: Accessor<boolean>) {
    this.field = field;
    this.isDisabled = disabled;
  }

  get disabled() {
    return this.isDisabled();
  }

  get touched() {
    return this.field.touched;
  }

  get dirty() {
    return this.field.dirty;
  }

  get valid() {
    return this.field.valid;
  }

  get filled() {
    return this.field.filled;
  }

  get focused() {
    return this.field.focused;
  }
}

/** The native item inside its labelable provider. */
function NativeFieldItem(componentProps: FieldItem.Props): JSX.Element {
  const { state: fieldState, disabled: rootDisabled } = useFieldRootContext(false);
  const disabled = () => Boolean(rootDisabled() || componentProps.disabled);
  const fieldItemContext: FieldItemContext = { disabled };
  const state = new NativeFieldItemState(fieldState, disabled);
  return provideNativeContext(FieldItemContext, fieldItemContext, () =>
    renderNativeElement(DIV, componentProps, {
      own: OWN_KEYS,
      state,
      stateWriter: writeFieldState,
      mapping: fieldValidityMapping,
      reactive: true,
    }),
  ) as unknown as JSX.Element;
}

export interface FieldItemState extends FieldRootState {}

export interface FieldItemProps extends BaseUIComponentProps<'div', FieldItemState> {
  /**
   * Whether the wrapped control should ignore user interaction.
   * The `disabled` prop on `<Field.Root>` takes precedence over this.
   * @default false
   */
  disabled?: boolean | undefined;
}

export namespace FieldItem {
  export type State = FieldItemState;
  export type Props = FieldItemProps;
}
