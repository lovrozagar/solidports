import { isStatic, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { mayBeTruthy, omitComponentProps } from '../solid-helpers';
import { useCompositeRootContext } from '../internals/composite/root/CompositeRootContext';
import { useButton } from '../internals/use-button/useButton';
import { canRenderNative, partHandler } from '../utils/native';
import { compileStateWriter, renderNativeElement } from '../utils/native/element';
import type { SetAttribute } from '../utils/native/element';
import type { BaseUIComponentProps, NativeButtonProps } from '../utils/types';
import { useRenderElement } from '../utils/useRenderElement';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set([
  'disabled',
  'focusableWhenDisabled',
  'nativeButton',
]);

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Button](https://base-ui.com/react/components/button)
 */
export function Button(componentProps: Button.Props) {
  // Native fast path (`context/architecture/render-pipeline.md`): a native `<button>` outside a
  // composite root, on the client, the server and while hydrating. Everything else (a `render`
  // prop, spread props, a composite item, a non-native button) keeps `useRenderElement`.
  if (
    useCompositeRootContext(true) == null &&
    canRenderNative(componentProps, NATIVE_STATIC_KEYS, true) &&
    untrack(() => componentProps.nativeButton ?? true) === true
  ) {
    return NativeButton(componentProps);
  }

  const elementProps = omitComponentProps(componentProps, [
    'disabled',
    'focusableWhenDisabled',
    'nativeButton',
  ] as const);
  const disabled = () => Boolean(componentProps.disabled);
  const focusableWhenDisabled = () => componentProps.focusableWhenDisabled ?? false;
  const nativeButton = () => Boolean(componentProps.nativeButton ?? true);

  const { buttonSources, buttonRef } = useButton({
    disabled,
    focusableWhenDisabled,
    native: nativeButton,
  });

  const state: Button.State = {
    get disabled() {
      return disabled();
    },
  };

  const element = useRenderElement('button', componentProps, {
    props: [...buttonSources.attributes, elementProps, buttonSources.handlers],
    ref: buttonRef,
    state,
  });

  return element();
}

/** The button's element: a focusable `<button>`; the server renders the same literals. */
const BUTTON = {
  tag: 'button',
  attributes: { type: 'button', tabindex: '0' },
  // eslint-disable-next-line jsx-a11y/control-has-associated-label -- the template button is labelled by the part's children
  create: () => (<button type="button" tabindex="0" />) as unknown as Element,
};

const writeButtonState = compileStateWriter(['disabled'], undefined);

/**
 * What a native button's handlers, attributes and state read: its props, with `disabled` and
 * `focusableWhenDisabled` as prototype getters, so a button allocates this one object and no
 * closures. It is also the state view its `data-disabled` is written from.
 */
class ButtonModel {
  declare readonly props: Button.Props;

  constructor(props: Button.Props) {
    this.props = props;
  }

  get disabled(): boolean {
    return Boolean(this.props.disabled);
  }

  get focusable(): boolean {
    return Boolean(this.props.focusableWhenDisabled);
  }
}

/** The state `class`/`style` functions receive, built only when the consumer passes one. */
const stateOf = (model: ButtonModel): Button.State => ({
  get disabled() {
    return model.disabled;
  },
});

/**
 * The button's attributes, as `useButton` and `useFocusableWhenDisabled` produce them for a native
 * button: `aria-disabled` while focusable when disabled, else the `disabled` attribute.
 */
function writeButtonAttributes(w: SetAttribute, model: ButtonModel) {
  const disabled = model.disabled;
  const focusable = model.focusable;
  w.set('aria-disabled', focusable ? String(disabled) : undefined);
  w.set('disabled', !focusable && disabled ? true : undefined);
}

/** A disabled button cancels the event and runs no handler. */
function preventWhileDisabled(model: ButtonModel, event: Event) {
  if (model.disabled) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (model: ButtonModel) => !model.disabled;

/**
 * A button's handlers, composed as `useButton` composes them for a native button: the disabled
 * gate first, then the consumer's handler. The after-consumer keyboard logic of `useButton` is a
 * no-op for a native button (the browser activates it). Bound on a button that can be disabled; a
 * never-disabled button binds them only for the keys the consumer passes.
 */
const BUTTON_HANDLERS = {
  onClick: partHandler<ButtonModel, MouseEvent>('onClick', undefined, preventWhileDisabled),
  onPointerDown: partHandler<ButtonModel, PointerEvent>(
    'onPointerDown',
    undefined,
    preventWhileDisabled,
  ),
  onKeyDown: partHandler<ButtonModel, KeyboardEvent>('onKeyDown', undefined, (model, event) => {
    // Allow Tabbing away from a focusable-when-disabled button; block every other key.
    if (model.disabled && model.focusable && event.key !== 'Tab') {
      event.preventDefault();
    }
    return !model.disabled;
  }),
};

/** The disabled gate for a consumer's `onMouseDown` and `onKeyUp`, bound only when passed. */
const BUTTON_HANDLERS_IF_PASSED = {
  onMouseDown: partHandler<ButtonModel>('onMouseDown', undefined, runWhileEnabled),
  onKeyUp: partHandler<ButtonModel>('onKeyUp', undefined, runWhileEnabled),
};

/**
 * A never-disabled button's handlers: each one only for a key the consumer passes, so every button
 * shares the same dispatchers (one record per button) rather than a closure per handler.
 */
const ALL_BUTTON_HANDLERS_IF_PASSED = { ...BUTTON_HANDLERS, ...BUTTON_HANDLERS_IF_PASSED };

/**
 * The native `<button>`: `useButton` + `useFocusableWhenDisabled` for a non-composite native
 * button, inlined, on the client, the server and while hydrating.
 */
function NativeButton(props: Button.Props): JSX.Element {
  const gated = mayBeTruthy(props, 'disabled');
  const model = new ButtonModel(props);
  return renderNativeElement(BUTTON, props, {
    own: OWN_KEYS,
    state: stateOf,
    stateView: model,
    stateWriter: writeButtonState,
    attributes: writeButtonAttributes,
    reactive: !isStatic(props, 'disabled') || !isStatic(props, 'focusableWhenDisabled'),
    handlers: gated ? BUTTON_HANDLERS : undefined,
    handlersIfPassed: gated ? BUTTON_HANDLERS_IF_PASSED : ALL_BUTTON_HANDLERS_IF_PASSED,
    handlerTarget: model,
  }) as unknown as JSX.Element;
}

export interface ButtonState {
  /**
   * Whether the button should ignore user interaction.
   */
  disabled: boolean;
}

export interface ButtonProps
  extends NativeButtonProps, BaseUIComponentProps<'button', ButtonState> {
  /**
   * Whether the button should be focusable when disabled.
   * @default false
   */
  focusableWhenDisabled?: boolean | undefined;
}

export namespace Button {
  export type State = ButtonState;
  export type Props = ButtonProps;
}
