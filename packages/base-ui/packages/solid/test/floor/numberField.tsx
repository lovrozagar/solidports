/*
 * The hand-written Solid floor for a number field (D32's sweep): the fewest reactive nodes plain
 * Solid 2 needs for the DOM `NumberField.Root`, `ScrubArea`, `Group`, `Input`, `Increment` and
 * `Decrement` render. The root holds the value and the input's id, and renders the hidden native
 * number input beside its `<div>`; the input writes the formatted value from one render effect,
 * and each stepper steps the value and disables itself at its bound from one render effect.
 *
 * Cost tests (`numberField.cost.test.tsx`) report each part's nodes against this one.
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

interface FloorNumberFieldContextValue {
  id: string;
  value: Accessor<number | null>;
  setValue: Setter<number | null>;
  max: number | undefined;
  min: number | undefined;
}

const FloorNumberFieldContext = createContext<FloorNumberFieldContextValue | null>(null);

const HIDDEN_INPUT_STYLE =
  'border: 0px; clip-path: inset(50%); height: 1px; margin: 0px; overflow: hidden; padding: 0px; white-space: nowrap; width: 1px; position: fixed; top: 0px; left: 0px;';

/** The root: the value, its `<div>` and the hidden number input it keeps in sync. */
export function FloorNumberFieldRoot(props: {
  min?: number | undefined;
  max?: number | undefined;
  children?: JSX.Element;
}) {
  const [value, setValue] = createSignal<number | null>(null);
  const hidden = (
    <input type="number" step="1" aria-hidden="true" tabindex="-1" style={HIDDEN_INPUT_STYLE} />
  ) as HTMLInputElement;
  createRenderEffect(value, (current) => {
    hidden.value = current == null ? '' : String(current);
    hidden.setAttribute('value', hidden.value);
  });
  return [
    <div>
      <FloorNumberFieldContext
        value={{
          id: `base-ui-${createUniqueId()}`,
          value,
          setValue,
          max: props.max,
          min: props.min,
        }}
      >
        {props.children}
      </FloorNumberFieldContext>
    </div>,
    hidden,
  ];
}

/** The scrub area: a `<span>` that takes no touch or text selection. */
export function FloorNumberFieldScrubArea(props: { children?: JSX.Element }) {
  return (
    <span
      role="presentation"
      style={{ 'touch-action': 'none', '-webkit-user-select': 'none', 'user-select': 'none' }}
    >
      {props.children}
    </span>
  );
}

/** The group: a `<div role="group">`. */
export function FloorNumberFieldGroup(props: { children?: JSX.Element }) {
  return <div role="group">{props.children}</div>;
}

/** The input: its id and the formatted value from one render effect. */
export function FloorNumberFieldInput() {
  const context = useContext(FloorNumberFieldContext)!;
  const el = (
    <input
      type="text"
      autocomplete="off"
      autocorrect="off"
      spellcheck="false"
      aria-roledescription="Number field"
      id={context.id}
      inputmode="numeric"
    />
  ) as HTMLInputElement;
  createRenderEffect(context.value, (value) => {
    el.value = value == null ? '' : String(value);
  });
  return el;
}

function step(context: FloorNumberFieldContextValue, direction: number) {
  context.setValue((value) => (value ?? 0) + direction);
}
function increment(context: FloorNumberFieldContextValue) {
  step(context, 1);
}
function decrement(context: FloorNumberFieldContextValue) {
  step(context, -1);
}

/** A stepper: one render effect disables it at its bound. */
function FloorNumberFieldStepper(props: { direction: 1 | -1 }) {
  const context = useContext(FloorNumberFieldContext)!;
  const el = (
    <button
      type="button"
      tabindex="-1"
      aria-label={props.direction === 1 ? 'Increase' : 'Decrease'}
      aria-controls={context.id}
      style={{ '-webkit-user-select': 'none', 'user-select': 'none' }}
      onClick={[props.direction === 1 ? increment : decrement, context]}
    />
  ) as HTMLButtonElement;
  const bound = props.direction === 1 ? context.max : context.min;
  createRenderEffect(
    () => {
      const value = context.value();
      return (
        bound !== undefined && value != null && value * props.direction >= bound * props.direction
      );
    },
    (atBound) => {
      el.disabled = atBound;
      el.setAttribute('aria-disabled', atBound ? 'true' : 'false');
    },
  );
  return el;
}

export function FloorNumberFieldIncrement() {
  return <FloorNumberFieldStepper direction={1} />;
}

export function FloorNumberFieldDecrement() {
  return <FloorNumberFieldStepper direction={-1} />;
}
