/*
 * The hand-written Solid floor for a one-time-code field (D32's sweep): the fewest reactive nodes
 * plain Solid 2 needs for the DOM `OTPField.Root` and its `OTPField.Input`s render. The root holds
 * the value and renders the hidden form input beside its `<div role="group">`; each slot takes its
 * index once and writes the attributes that follow the value and focus from one render effect.
 *
 * Cost tests (`otpField.cost.test.tsx`) report each part's nodes against this one.
 */
import {
  createContext,
  createRenderEffect,
  createSignal,
  createUniqueId,
  useContext,
} from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface FloorOTPFieldContextValue {
  id: string;
  length: number;
  value: Accessor<string>;
  setValue: Setter<string>;
  nextIndex: () => number;
}

const FloorOTPFieldContext = createContext<FloorOTPFieldContextValue | null>(null);

const HIDDEN_INPUT_STYLE = {
  border: '0px',
  'clip-path': 'inset(50%)',
  height: '1px',
  margin: '0px',
  overflow: 'hidden',
  padding: '0px',
  'white-space': 'nowrap',
  width: '1px',
  position: 'fixed',
  top: '0px',
  left: '0px',
} as const;

/** The root: the value, its `<div role="group">` and the hidden input the form reads. */
export function FloorOTPFieldRoot(props: { length: number; children?: JSX.Element }) {
  const [value, setValue] = createSignal('');
  const id = `base-ui-${createUniqueId()}`;
  let index = 0;
  const hidden = (
    <input
      type="text"
      id={`${id}-hidden-input`}
      autocomplete="one-time-code"
      inputmode="numeric"
      minlength={props.length}
      maxlength={props.length}
      pattern={`\\d{${props.length}}`}
      aria-hidden="true"
      tabindex="-1"
      style={HIDDEN_INPUT_STYLE}
    />
  ) as HTMLInputElement;
  createRenderEffect(value, (current) => {
    hidden.value = current;
  });
  return [
    <div role="group">
      <FloorOTPFieldContext
        value={{
          id,
          length: props.length,
          value,
          setValue,
          nextIndex: () => {
            index += 1;
            return index - 1;
          },
        }}
      >
        {props.children}
      </FloorOTPFieldContext>
    </div>,
    hidden,
  ];
}

/** A slot: its index taken once, and its focus order from one render effect over the value. */
export function FloorOTPFieldInput() {
  const context = useContext(FloorOTPFieldContext)!;
  const index = context.nextIndex();
  const last = index === context.length - 1;
  const el = (
    <input
      autocorrect="off"
      spellcheck="false"
      data-length={context.length}
      id={index === 0 ? context.id : `${context.id}-${index + 1}`}
      type="text"
      inputmode="numeric"
      autocomplete={index === 0 ? 'one-time-code' : 'off'}
      enterkeyhint={last ? 'done' : 'next'}
      pattern="\d{1}"
    />
  ) as HTMLInputElement;
  createRenderEffect(context.value, (value) => {
    const active = Math.min(value.length, context.length - 1) === index;
    el.tabIndex = active ? 0 : -1;
    if (index === 0) {
      el.maxLength = context.length;
    }
    el.value = value[index] ?? '';
  });
  return el;
}
