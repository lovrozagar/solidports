import { isStatic, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { omitComponentProps } from '../solid-helpers';
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

const isDisabled = (props: Button.Props) => Boolean(props.disabled);
const isFocusable = (props: Button.Props) => Boolean(props.focusableWhenDisabled);

/**
 * The state view a button that can be disabled writes its `data-disabled` from: `disabled` as a
 * prototype getter over the props, one object per such button.
 */
class ButtonStateView {
  declare readonly props: Button.Props;

  constructor(props: Button.Props) {
    this.props = props;
  }

  get disabled(): boolean {
    return isDisabled(this.props);
  }
}

/** The state `class`/`style` functions receive, built only when the consumer passes one. */
const stateOf = (props: Button.Props): Button.State => ({
  get disabled() {
    return isDisabled(props);
  },
});

/**
 * The button's attributes, as `useButton` and `useFocusableWhenDisabled` produce them for a native
 * button: `aria-disabled` while focusable when disabled, else the `disabled` attribute.
 */
function writeButtonAttributes(w: SetAttribute, props: Button.Props) {
  const disabled = isDisabled(props);
  const focusable = isFocusable(props);
  w.set('aria-disabled', focusable ? String(disabled) : undefined);
  w.set('disabled', !focusable && disabled ? true : undefined);
}

/** A disabled button cancels the event and runs no handler. */
function preventWhileDisabled(props: Button.Props, event: Event) {
  if (isDisabled(props)) {
    event.preventDefault();
    return false;
  }
  return true;
}

const runWhileEnabled = (props: Button.Props) => !isDisabled(props);

/**
 * A button's handlers, composed as `useButton` composes them for a native button: the disabled
 * gate first, then the consumer's handler. The after-consumer keyboard logic of `useButton` is a
 * no-op for a native button (the browser activates it). Bound on a button that can be disabled; a
 * never-disabled button binds them only for the keys the consumer passes.
 */
const BUTTON_HANDLERS = {
  onClick: partHandler<Button.Props, MouseEvent>('onClick', undefined, preventWhileDisabled),
  onPointerDown: partHandler<Button.Props, PointerEvent>(
    'onPointerDown',
    undefined,
    preventWhileDisabled,
  ),
  onKeyDown: partHandler<Button.Props, KeyboardEvent>('onKeyDown', undefined, (props, event) => {
    // Allow Tabbing away from a focusable-when-disabled button; block every other key.
    if (isDisabled(props) && isFocusable(props) && event.key !== 'Tab') {
      event.preventDefault();
    }
    return !isDisabled(props);
  }),
};

/** The disabled gate for a consumer's `onMouseDown` and `onKeyUp`, bound only when passed. */
const BUTTON_HANDLERS_IF_PASSED = {
  onMouseDown: partHandler<Button.Props>('onMouseDown', undefined, runWhileEnabled),
  onKeyUp: partHandler<Button.Props>('onKeyUp', undefined, runWhileEnabled),
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
  // The body runs untracked (`createComponent`): these reads subscribe to nothing.
  const disabledIsStatic = isStatic(props, 'disabled');
  const focusableIsStatic = isStatic(props, 'focusableWhenDisabled');
  // A button that can never be disabled binds no gate and writes no `data-disabled`; one that can
  // also never be focusable when disabled writes no attribute of its own at all.
  const gated = !disabledIsStatic || Boolean(props.disabled);
  const writes = gated || !focusableIsStatic || Boolean(props.focusableWhenDisabled);
  return renderNativeElement(BUTTON, props, {
    own: OWN_KEYS,
    state: stateOf,
    stateView: gated ? new ButtonStateView(props) : undefined,
    stateWriter: writeButtonState,
    stateAttributes: gated,
    attributes: writes ? writeButtonAttributes : undefined,
    reactive: !disabledIsStatic || !focusableIsStatic,
    handlers: gated ? BUTTON_HANDLERS : undefined,
    handlersIfPassed: gated ? BUTTON_HANDLERS_IF_PASSED : ALL_BUTTON_HANDLERS_IF_PASSED,
    handlerTarget: props,
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
