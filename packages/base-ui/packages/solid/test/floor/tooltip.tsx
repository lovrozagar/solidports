/*
 * The hand-written Solid floor for a closed Tooltip trigger (D32's sweep): the fewest reactive
 * nodes plain Solid 2 needs for the DOM `Tooltip.Trigger` renders while its tooltip is closed. The
 * root is one open signal; the trigger writes `data-popup-open` from one render effect, and its
 * hover handlers are module-level functions bound to the root.
 *
 * Cost tests (`tooltip.cost.test.tsx`) report the trigger's nodes against this one.
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

interface FloorTooltipContextValue {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
}

const FloorTooltipContext = createContext<FloorTooltipContextValue | null>(null);

/** The root: one open signal. */
export function FloorTooltipRoot(props: { children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  return <FloorTooltipContext value={{ open, setOpen }}>{props.children}</FloorTooltipContext>;
}

function show(context: FloorTooltipContextValue) {
  context.setOpen(true);
}

function hide(context: FloorTooltipContextValue) {
  context.setOpen(false);
}

/** The trigger: its button and one render effect for its open state. */
export function FloorTooltipTrigger(props: { children?: JSX.Element }) {
  const context = useContext(FloorTooltipContext)!;
  const el = (
    <button
      id={`base-ui-${createUniqueId()}`}
      data-base-ui-tooltip-trigger=""
      type="button"
      onMouseEnter={[show, context]}
      onMouseLeave={[hide, context]}
      onFocus={[show, context]}
      onBlur={[hide, context]}
    >
      {props.children}
    </button>
  ) as HTMLButtonElement;
  createRenderEffect(context.open, (open) => {
    if (open) {
      el.setAttribute('data-popup-open', '');
    } else {
      el.removeAttribute('data-popup-open');
    }
  });
  return el;
}
