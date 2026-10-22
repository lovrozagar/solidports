/*
 * The hand-written Solid floor for a field in a fieldset (D32's sweep): the fewest reactive nodes
 * plain Solid 2 needs for the DOM `Fieldset.Root`, `Fieldset.Legend`, `Field.Root`, `Field.Label`,
 * `Field.Control`, `Field.Description` and a valid `Field.Error` render. Ids register with their
 * group through signals; each element that follows them writes from one render effect; the error
 * renders nothing until the field is invalid.
 *
 * Cost tests (`field.cost.test.tsx`) report each part's nodes against this one.
 */
import {
  createContext,
  createRenderEffect,
  createSignal,
  createUniqueId,
  onCleanup,
  Show,
  useContext,
} from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';

function setOrRemove(el: Element, name: string, value: string | undefined) {
  if (value === undefined) {
    el.removeAttribute(name);
  } else {
    el.setAttribute(name, value);
  }
}

/** Registers `id` through `set` while the caller's owner lives. */
function register(set: Setter<string | undefined>, id: string) {
  set(id);
  onCleanup(() => set((current) => (current === id ? undefined : current)));
}

const nextId = () => `base-ui-${createUniqueId()}`;

interface FloorFieldsetContextValue {
  setLegendId: Setter<string | undefined>;
}

const FloorFieldsetContext = createContext<FloorFieldsetContextValue | null>(null);

/** The fieldset: its legend's id from one render effect. */
export function FloorFieldsetRoot(props: { children?: JSX.Element }) {
  const [legendId, setLegendId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const el = (
    <fieldset>
      <FloorFieldsetContext value={{ setLegendId }}>{props.children}</FloorFieldsetContext>
    </fieldset>
  ) as HTMLFieldSetElement;
  createRenderEffect(legendId, (id) => setOrRemove(el, 'aria-labelledby', id));
  return el;
}

/** The legend: a `<div>` with an id it registers with the fieldset. */
export function FloorFieldsetLegend(props: { children?: JSX.Element }) {
  const context = useContext(FloorFieldsetContext)!;
  const id = nextId();
  register(context.setLegendId, id);
  return <div id={id}>{props.children}</div>;
}

interface FloorFieldContextValue {
  controlId: Accessor<string | undefined>;
  setControlId: Setter<string | undefined>;
  labelId: Accessor<string | undefined>;
  setLabelId: Setter<string | undefined>;
  messageId: Accessor<string | undefined>;
  setMessageId: Setter<string | undefined>;
  invalid: Accessor<boolean>;
}

const FloorFieldContext = createContext<FloorFieldContextValue | null>(null);

/** The field: its `<div>` and the ids its parts register. */
export function FloorFieldRoot(props: { children?: JSX.Element }) {
  const [controlId, setControlId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [labelId, setLabelId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [messageId, setMessageId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const [invalid] = createSignal(false);
  return (
    <div>
      <FloorFieldContext
        value={{ controlId, setControlId, labelId, setLabelId, messageId, setMessageId, invalid }}
      >
        {props.children}
      </FloorFieldContext>
    </div>
  );
}

/** The label: its id and the control it labels, from one render effect. */
export function FloorFieldLabel(props: { children?: JSX.Element }) {
  const context = useContext(FloorFieldContext)!;
  const id = nextId();
  register(context.setLabelId, id);
  const el = (<label id={id}>{props.children}</label>) as HTMLLabelElement;
  createRenderEffect(context.controlId, (controlId) => setOrRemove(el, 'for', controlId));
  return el;
}

/** The control: an `<input>` with its id, labelled and described from one render effect. */
export function FloorFieldControl() {
  const context = useContext(FloorFieldContext)!;
  const id = nextId();
  register(context.setControlId, id);
  const el = (<input id={id} />) as HTMLInputElement;
  createRenderEffect(
    () => [context.labelId(), context.messageId()] as const,
    ([labelId, messageId]) => {
      setOrRemove(el, 'aria-labelledby', labelId);
      setOrRemove(el, 'aria-describedby', messageId);
    },
  );
  return el;
}

/** The description: a `<p>` with an id it registers as the field's message. */
export function FloorFieldDescription(props: { children?: JSX.Element }) {
  const context = useContext(FloorFieldContext)!;
  const id = nextId();
  register(context.setMessageId, id);
  return <p id={id}>{props.children}</p>;
}

/** The error: nothing while the field is valid. */
export function FloorFieldError(props: { children?: JSX.Element }) {
  const context = useContext(FloorFieldContext)!;
  return (
    <Show when={context.invalid()}>
      <div>{props.children}</div>
    </Show>
  );
}
