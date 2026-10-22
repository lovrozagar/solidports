/*
 * The hand-written Solid floor for a closed PreviewCard trigger (D32's sweep): the fewest reactive
 * nodes plain Solid 2 needs for the DOM `PreviewCard.Trigger` renders while its card is closed. The
 * root is one open signal; the trigger writes `data-popup-open` from one render effect, and its
 * hover and focus handlers are module-level functions bound to the root.
 *
 * Cost tests (`previewCard.cost.test.tsx`) report the trigger's nodes against this one.
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

interface FloorPreviewCardContextValue {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
}

const FloorPreviewCardContext = createContext<FloorPreviewCardContextValue | null>(null);

/** The root: one open signal. */
export function FloorPreviewCardRoot(props: { children?: JSX.Element }) {
  const [open, setOpen] = createSignal(false);
  return (
    <FloorPreviewCardContext value={{ open, setOpen }}>{props.children}</FloorPreviewCardContext>
  );
}

function show(context: FloorPreviewCardContextValue) {
  context.setOpen(true);
}

function hide(context: FloorPreviewCardContextValue) {
  context.setOpen(false);
}

/** The trigger: its link and one render effect for its open state. */
export function FloorPreviewCardTrigger(props: { href?: string; children?: JSX.Element }) {
  const context = useContext(FloorPreviewCardContext)!;
  const el = (
    <a
      id={`base-ui-${createUniqueId()}`}
      href={props.href}
      onMouseEnter={[show, context]}
      onMouseLeave={[hide, context]}
      onFocus={[show, context]}
      onBlur={[hide, context]}
    >
      {props.children}
    </a>
  ) as HTMLAnchorElement;
  createRenderEffect(context.open, (open) => {
    if (open) {
      el.setAttribute('data-popup-open', '');
    } else {
      el.removeAttribute('data-popup-open');
    }
  });
  return el;
}
