/*
 * The hand-written Solid floor for one toast (D32's sweep): the fewest reactive nodes plain Solid 2
 * needs for the DOM a `Toast.Root` with Content, Title, Description and Close renders. The root
 * writes its CSS variables and labels from one render effect over the toast's place; Title and
 * Description render only with content and register their ids with the root; Close writes
 * `aria-hidden` from one render effect.
 *
 * Cost tests (`toast.cost.test.tsx`) report each part's nodes against this one.
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

export interface FloorToastData {
  id: string;
  title?: string | undefined;
  description?: string | undefined;
}

interface FloorToastContextValue {
  toast: FloorToastData;
  expanded: Accessor<boolean>;
  close: (id: string) => void;
  setTitleId: Setter<string | undefined>;
  setDescriptionId: Setter<string | undefined>;
}

const FloorToastContext = createContext<FloorToastContextValue | null>(null);

/**
 * The root: its `<div>` and one render effect for its place in the stack and its labels. `index`
 * and `offsetY` are the toast's place, read from the store's per-toast metadata.
 */
export function FloorToastRoot(props: {
  toast: FloorToastData;
  index: Accessor<number>;
  offsetY: Accessor<number>;
  expanded: Accessor<boolean>;
  close: (id: string) => void;
  children?: JSX.Element;
}) {
  const [titleId, setTitleId] = createSignal<string | undefined>(undefined, { ownedWrite: true });
  const [descriptionId, setDescriptionId] = createSignal<string | undefined>(undefined, {
    ownedWrite: true,
  });
  const el = (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the toast's own DOM: its root is focusable
    <div role="dialog" tabindex="0" aria-modal="false">
      <FloorToastContext
        value={{
          toast: props.toast,
          expanded: props.expanded,
          close: props.close,
          setTitleId,
          setDescriptionId,
        }}
      >
        {props.children}
      </FloorToastContext>
    </div>
  ) as HTMLDivElement;
  createRenderEffect(
    () => [props.index(), props.offsetY(), titleId(), descriptionId()] as const,
    ([index, offsetY, labelledBy, describedBy]) => {
      el.style.setProperty('--toast-swipe-movement-x', '0px');
      el.style.setProperty('--toast-swipe-movement-y', '0px');
      el.style.setProperty('--toast-index', String(index));
      el.style.setProperty('--toast-offset-y', `${offsetY}px`);
      setOrRemove(el, 'aria-labelledby', labelledBy);
      setOrRemove(el, 'aria-describedby', describedBy);
    },
  );
  return el;
}

function setOrRemove(el: Element, name: string, value: string | undefined) {
  if (value === undefined) {
    el.removeAttribute(name);
  } else {
    el.setAttribute(name, value);
  }
}

/** The content: a plain `<div>`. */
export function FloorToastContent(props: { children?: JSX.Element }) {
  return <div>{props.children}</div>;
}

/** A label (Title, Description): rendered only with content, registering its id while it renders. */
function FloorToastLabel(props: {
  tag: 'h2' | 'p';
  text: string | undefined;
  register: Setter<string | undefined>;
}) {
  return (
    <Show when={props.text}>
      {(text) => {
        const id = `mui-${createUniqueId()}`;
        props.register(id);
        onCleanup(() => props.register((current) => (current === id ? undefined : current)));
        return props.tag === 'h2' ? <h2 id={id}>{text()}</h2> : <p id={id}>{text()}</p>;
      }}
    </Show>
  );
}

export function FloorToastTitle() {
  const context = useContext(FloorToastContext)!;
  return <FloorToastLabel tag="h2" text={context.toast.title} register={context.setTitleId} />;
}

export function FloorToastDescription() {
  const context = useContext(FloorToastContext)!;
  return (
    <FloorToastLabel
      tag="p"
      text={context.toast.description}
      register={context.setDescriptionId}
    />
  );
}

function close(context: FloorToastContextValue) {
  context.close(context.toast.id);
}

/** The close button: one render effect for `aria-hidden`, hidden while collapsed and unfocused. */
export function FloorToastClose(props: { children?: JSX.Element }) {
  const context = useContext(FloorToastContext)!;
  const [focused, setFocused] = createSignal(false);
  const el = (
    <button
      type="button"
      tabindex="0"
      onClick={[close, context]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {props.children}
    </button>
  ) as HTMLButtonElement;
  createRenderEffect(
    () => context.expanded() || focused(),
    (visible) => {
      setOrRemove(el, 'aria-hidden', visible ? undefined : 'true');
    },
  );
  return el;
}
