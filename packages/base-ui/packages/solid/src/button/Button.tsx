import { getOwner, isStatic, untrack } from 'solid-js';
import { insert } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { omitComponentProps } from '../solid-helpers';
import { makeEventPreventable } from '../merge-props/mergeProps';
import { useCompositeRootContext } from '../internals/composite/root/CompositeRootContext';
import { useButton } from '../internals/use-button/useButton';
import {
  applyRefs,
  attachNativeAttributes,
  canRenderNative,
  classifyConsumerProps,
  composeHandler,
  readReactiveProps,
  resolveClass,
  resolveStyle,
  stateAttr,
} from '../utils/native';
import type { BaseUIComponentProps, BaseUIEvent, NativeButtonProps } from '../utils/types';
import { useRenderElement } from '../utils/useRenderElement';

/** Props the native path reads once, as the slow path does (`useButton` reads `native` at setup). */
const NATIVE_STATIC_KEYS = ['nativeButton'] as const;
/** The part's own props: never forwarded to the element. */
const OWN_KEYS: ReadonlySet<string> = new Set(['disabled', 'focusableWhenDisabled', 'nativeButton']);

/**
 * A button component that can be used to trigger actions.
 * Renders a `<button>` element.
 *
 * Documentation: [Base UI Button](https://base-ui.com/react/components/button)
 */
export function Button(componentProps: Button.Props) {
  // Solid-native fast path (plan 8, `.kb/solid/native-parts.md`): a native `<button>` outside a
  // composite root, rendered with direct JSX. Everything else (a `render` prop, spread props, a
  // composite item, a non-native button, the server and hydration) keeps `useRenderElement`.
  if (
    useCompositeRootContext(true) == null &&
    canRenderNative(componentProps, NATIVE_STATIC_KEYS) &&
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

type ButtonEvent<T extends Event> = BaseUIEvent<T>;

const isDisabled = (props: Button.Props) => Boolean(props.disabled);
const isFocusableWhenDisabled = (props: Button.Props) => Boolean(props.focusableWhenDisabled);

// The part's own handlers when the consumer passes none, shared by every native button and bound
// per element with Solid's `[handler, data]` form (no closure per button).
function gateActivation(props: Button.Props, event: Event) {
  makeEventPreventable(event as ButtonEvent<Event>);
  if (untrack(() => isDisabled(props))) {
    event.preventDefault();
  }
}
function gateKeyDown(props: Button.Props, event: KeyboardEvent) {
  makeEventPreventable(event as ButtonEvent<KeyboardEvent>);
  // Allow Tabbing away from a focusable-when-disabled button; block every other key.
  if (untrack(() => isDisabled(props) && isFocusableWhenDisabled(props)) && event.key !== 'Tab') {
    event.preventDefault();
  }
}

/** The consumer's handler for one of the button's keys, behind the part's gate. */
function wrapButtonHandler(
  props: Button.Props,
  key: string,
  read: () => ((...args: unknown[]) => unknown) | undefined,
) {
  switch (key.toLowerCase()) {
    case 'onclick':
    case 'onpointerdown':
      return composeHandler<MouseEvent>(read, undefined, (event) => {
        if (isDisabled(props)) {
          event.preventDefault();
          return false;
        }
        return true;
      });
    case 'onmousedown':
    case 'onkeyup':
      return composeHandler<Event>(read, undefined, () => !isDisabled(props));
    case 'onkeydown':
      return composeHandler<KeyboardEvent>(read, undefined, (event) => {
        if (isDisabled(props) && isFocusableWhenDisabled(props) && event.key !== 'Tab') {
          event.preventDefault();
        }
        return !isDisabled(props);
      });
    default:
      return undefined;
  }
}

/**
 * The part's attributes in the slow path's order (a consumer key always wins), the reactive
 * consumer keys and `class`/`style`. `disabled` is written as `true`/absent (the slow path writes
 * `false`, which the runtime removes the same way). On the literal path (`keepUndefined` false) a
 * key with no value is left out: a fresh element has nothing to remove.
 */
function buttonAttributes(
  props: Button.Props,
  keys: ReadonlySet<string>,
  reactive: readonly string[],
  state: Button.State | undefined,
  target: Record<string, unknown>,
  keepUndefined: boolean,
) {
  const disabled = isDisabled(props);
  const focusable = isFocusableWhenDisabled(props);
  const set = (key: string, value: unknown) => {
    if (keepUndefined || value !== undefined) {
      target[key] = value;
    }
  };
  if (!keys.has('data-disabled')) {
    set('data-disabled', stateAttr(disabled));
  }
  if (!keys.has('aria-disabled')) {
    set('aria-disabled', focusable ? (disabled ? 'true' : 'false') : undefined);
  }
  if (!keys.has('disabled')) {
    set('disabled', !focusable && disabled ? true : undefined);
  }
  readReactiveProps(props, reactive, target);
  if (state) {
    if ('class' in props) {
      set('class', resolveClass(props.class, state));
    }
    if ('style' in props) {
      set('style', resolveStyle(props.style, state));
    }
  }
  return target;
}

/**
 * The native `<button>`: `useButton` + `useFocusableWhenDisabled` for a non-composite native
 * button, inlined. The after-consumer keyboard logic of `useButton` is a no-op for this case (a
 * native button activates itself), so each handler is the part's gate, then the consumer's.
 */
function NativeButton(props: Button.Props): JSX.Element {
  // The body runs untracked (`createComponent`): reads here subscribe to nothing.
  const owner = getOwner();
  const consumer = classifyConsumerProps(props, OWN_KEYS, (key, read) =>
    wrapButtonHandler(props, key, read),
  );
  const keys = consumer.keys;
  const hasHandler = (key: string) => keys.has(key) || keys.has(key.toLowerCase());
  // `class`/`style` functions receive the state; nothing else reads it.
  const state: Button.State | undefined =
    'class' in props || 'style' in props
      ? {
          get disabled() {
            return isDisabled(props);
          },
        }
      : undefined;
  const disabledIsStatic = !('disabled' in props) || isStatic(props, 'disabled');
  const focusableIsStatic =
    !('focusableWhenDisabled' in props) || isStatic(props, 'focusableWhenDisabled');
  // A button that can never be disabled needs no gate of its own: the gates only act while disabled.
  const mayBeDisabled = !disabledIsStatic || isDisabled(props);

  // `type="button"` and `tabindex="0"` come from the cloned template unless the consumer sets them.
  const templateStatics = !keys.has('type') && !keys.has('tabindex');
  const literal: Record<string, unknown> = {};
  if (!templateStatics) {
    if (!keys.has('type')) {
      literal.type = 'button';
    }
    if (!keys.has('tabindex')) {
      literal.tabindex = 0;
    }
  }
  Object.assign(literal, consumer.literal);
  // `onMouseDown`/`onKeyUp` only gate the consumer's handler: nothing to do without one.
  if (mayBeDisabled) {
    if (!hasHandler('onClick')) {
      literal.onClick = [gateActivation, props];
    }
    if (!hasHandler('onPointerDown')) {
      literal.onPointerDown = [gateActivation, props];
    }
    if (!hasHandler('onKeyDown')) {
      literal.onKeyDown = [gateKeyDown, props];
    }
  }

  // One effect when anything can change; none when every input is a literal.
  const needsEffect =
    consumer.reactive.length > 0 ||
    !disabledIsStatic ||
    !focusableIsStatic ||
    ('class' in props && (!isStatic(props, 'class') || typeof props.class === 'function')) ||
    ('style' in props && (!isStatic(props, 'style') || typeof props.style === 'function'));
  const dynamic = needsEffect
    ? () => buttonAttributes(props, keys, consumer.reactive, state, {}, true)
    : undefined;
  if (!needsEffect) {
    buttonAttributes(props, keys, consumer.reactive, state, literal, false);
  }

  // The element itself (a cloned template), its attributes, refs and children: no `ref` round trip.
  const el = (
    templateStatics ? <button type="button" tabindex="0" /> : <button />
  ) as unknown as HTMLButtonElement;
  attachNativeAttributes(el, literal, dynamic, owner);
  if (props.ref != null) {
    applyRefs(el, props.ref);
  }
  if (isStatic(props, 'children')) {
    insert(el, props.children);
  } else {
    insert(el, () => props.children);
  }
  return el as unknown as JSX.Element;
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
