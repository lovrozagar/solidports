/*
 * The hand-written Solid floor for Collapsible: the fewest reactive nodes plain Solid 2 needs for the
 * same DOM and ARIA as `Collapsible.Root` / `.Trigger` / `.Panel` render by default. Context rides
 * one transparent owner (no JSX provider), and the panel is a plain conditional (no `<Show>`). Cost
 * tests and the bench compare the parts against it: the exit bar is at most the floor plus 25%.
 */
import {
  createContext,
  createOwner,
  createSignal,
  createUniqueId,
  runWithOwner,
  useContext,
} from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
// `solid-js` does not re-export `setContext`; `@solidjs/signals` is the same core.
import { setContext } from '@solidjs/signals';

interface FloorCollapsible {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
  panelId: string;
}

const FloorContext = createContext<FloorCollapsible>();

export function FloorCollapsibleRoot(props: { defaultOpen?: boolean; children?: JSX.Element }) {
  // The default is read once, as an uncontrolled default.
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  const owner = createOwner({ transparent: true });
  setContext(FloorContext, { open, setOpen, panelId: createUniqueId() }, owner);
  return (
    <div data-open={open() ? '' : undefined} data-closed={open() ? undefined : ''}>
      {runWithOwner(owner, () => props.children)}
    </div>
  );
}

export function FloorCollapsibleTrigger(props: { children?: JSX.Element }) {
  const root = useContext(FloorContext)!;
  return (
    <button
      type="button"
      tabindex="0"
      data-panel-open={root.open() ? '' : undefined}
      aria-controls={root.open() ? root.panelId : undefined}
      aria-expanded={root.open() ? 'true' : 'false'}
      onClick={() => root.setOpen((open) => !open)}
    >
      {props.children}
    </button>
  );
}

export function FloorCollapsiblePanel(props: { children?: JSX.Element }) {
  const root = useContext(FloorContext)!;
  return (() =>
    root.open() ? (
      <div
        data-open=""
        id={root.panelId}
        style={{
          'animation-name': 'none',
          '--collapsible-panel-height': 'auto',
          '--collapsible-panel-width': 'auto',
        }}
      >
        {props.children}
      </div>
    ) : undefined) as unknown as JSX.Element;
}
