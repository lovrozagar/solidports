/*
 * The hand-written Solid floor for a closed Popover trigger (D32's sweep): the fewest reactive
 * nodes plain Solid 2 needs for the DOM and ARIA `Popover.Trigger` renders while its popover is
 * closed, the inert trailing span included (`utils/popups/TriggerFocusGuards.tsx`). A press toggles
 * the root's open signal; the trigger writes `aria-expanded` and `data-popup-open` from one render
 * effect, and its click handler is a module-level function bound to the root.
 *
 * Cost tests (`popover.cost.test.tsx`) report the trigger's nodes against this one.
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

interface FloorPopoverContextValue {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
}

const FloorPopoverContext = createContext<FloorPopoverContextValue | null>(null);

/** The root: one open signal. */
export function FloorPopoverRoot(props: { children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  return <FloorPopoverContext value={{ open, setOpen }}>{props.children}</FloorPopoverContext>;
}

function toggle(context: FloorPopoverContextValue) {
  context.setOpen((value) => !value);
}

/** The inert span's style, key for key as the trigger's (`visuallyHidden`). */
const HIDDEN: JSX.CSSProperties = {
  border: 0,
  'clip-path': 'inset(50%)',
  height: '1px',
  margin: 0,
  overflow: 'hidden',
  padding: 0,
  'white-space': 'nowrap',
  width: '1px',
  position: 'fixed',
  top: 0,
  left: 0,
};

/** The trigger: its button, one render effect for its open state, and the inert trailing span. */
export function FloorPopoverTrigger(props: { children?: JSX.Element }) {
  const context = useContext(FloorPopoverContext)!;
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
  return [el, <span aria-hidden="true" style={HIDDEN} />];
}
