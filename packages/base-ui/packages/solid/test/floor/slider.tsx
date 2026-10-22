/*
 * The hand-written Solid floor for a slider (D32's sweep): the fewest reactive nodes plain Solid 2
 * needs for the DOM `Slider.Root`, `Label`, `Value`, `Control`, `Track`, `Indicator` and `Thumb`
 * render. The root holds the value; the value text, the indicator's width, and the thumb's position
 * and range input each follow it from one render effect.
 *
 * Cost tests (`slider.cost.test.tsx`) report each part's nodes against this one.
 */
import { createContext, createRenderEffect, createSignal, createUniqueId, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface FloorSliderContextValue {
  id: string;
  inputId: string;
  value: Accessor<number>;
  setValue: Setter<number>;
}

const FloorSliderContext = createContext<FloorSliderContextValue | null>(null);

const INPUT_STYLE =
  'border: 0px; clip-path: inset(50%); height: 100%; margin: 0px; overflow: hidden; padding: 0px; white-space: nowrap; width: 100%; position: fixed; top: 0px; left: 0px;';

/** The root: the value and its `<div role="group">`, labelled by the label. */
export function FloorSliderRoot(props: { defaultValue: number; children?: JSX.Element }) {
  const [value, setValue] = createSignal(props.defaultValue);
  const id = `base-ui-${createUniqueId()}`;
  return (
    <div role="group" data-orientation="horizontal" id={id} aria-labelledby={`${id}-label`}>
      <FloorSliderContext
        value={{ id, inputId: `base-ui-${createUniqueId()}`, value, setValue }}
      >
        {props.children}
      </FloorSliderContext>
    </div>
  );
}

export function FloorSliderLabel(props: { children?: JSX.Element }) {
  const context = useContext(FloorSliderContext)!;
  return (
    <div data-orientation="horizontal" id={`${context.id}-label`}>
      {props.children}
    </div>
  );
}

/** The value: an `<output>` whose text follows the value. */
export function FloorSliderValue() {
  const context = useContext(FloorSliderContext)!;
  return (
    <output data-orientation="horizontal" aria-live="off" for={context.inputId}>
      {context.value()}
    </output>
  );
}

export function FloorSliderControl(props: { children?: JSX.Element }) {
  return <div data-orientation="horizontal">{props.children}</div>;
}

export function FloorSliderTrack(props: { children?: JSX.Element }) {
  return (
    <div data-orientation="horizontal" style={{ position: 'relative' }}>
      {props.children}
    </div>
  );
}

/** The indicator: its width follows the value from one render effect. */
export function FloorSliderIndicator() {
  const context = useContext(FloorSliderContext)!;
  const el = (<div data-orientation="horizontal" />) as HTMLDivElement;
  createRenderEffect(context.value, (value) => {
    el.setAttribute(
      'style',
      `position: relative; height: inherit; inset-inline-start: 0px; width: ${value}%;`,
    );
  });
  return el;
}

/** The thumb: its position and its range input follow the value from one render effect. */
export function FloorSliderThumb() {
  const context = useContext(FloorSliderContext)!;
  const input = (
    <input
      aria-orientation="horizontal"
      id={context.inputId}
      max="100"
      min="0"
      step="1"
      style={INPUT_STYLE}
      type="range"
      aria-labelledby={`${context.id}-label`}
    />
  ) as HTMLInputElement;
  const el = (
    <div data-orientation="horizontal" data-index="0" id={`base-ui-${createUniqueId()}`}>
      {input}
    </div>
  ) as HTMLDivElement;
  createRenderEffect(context.value, (value) => {
    el.setAttribute(
      'style',
      `position: absolute; inset-inline-start: ${value}%; top: 50%; translate: -50% -50%;`,
    );
    input.setAttribute('aria-valuenow', String(value));
    input.value = String(value);
  });
  return el;
}
