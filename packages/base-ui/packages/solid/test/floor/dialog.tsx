/*
 * The hand-written Solid floor for a closed Dialog trigger (D32's sweep): the fewest reactive nodes
 * plain Solid 2 needs for the DOM `Dialog.Trigger` renders while its dialog is closed. A press
 * toggles the root's open signal; the trigger writes `aria-expanded` and `data-popup-open` from one
 * render effect, and its click handler is a module-level function bound to the root.
 *
 * Cost tests (`dialog.cost.test.tsx`) report the trigger's nodes against this one.
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

interface FloorDialogContextValue {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
}

const FloorDialogContext = createContext<FloorDialogContextValue | null>(null);

/** The root: one open signal. */
export function FloorDialogRoot(props: { children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  return <FloorDialogContext value={{ open, setOpen }}>{props.children}</FloorDialogContext>;
}

function toggle(context: FloorDialogContextValue) {
  context.setOpen((value) => !value);
}

/** The trigger: its button and one render effect for its open state. */
export function FloorDialogTrigger(props: { children?: JSX.Element }) {
  const context = useContext(FloorDialogContext)!;
  const el = (
    <button
      type="button"
      data-base-ui-click-trigger=""
      aria-haspopup="dialog"
      tabindex="0"
      id={`base-ui-${createUniqueId()}`}
      aria-expanded="false"
      onClick={[toggle, context]}
    >
      {props.children}
    </button>
  ) as HTMLButtonElement;
  createRenderEffect(context.open, (open) => {
    el.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      el.setAttribute('data-popup-open', '');
    } else {
      el.removeAttribute('data-popup-open');
    }
  });
  return el;
}
