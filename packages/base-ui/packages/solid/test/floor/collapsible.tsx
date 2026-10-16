/*
 * The hand-written Solid floor for Collapsible: idiomatic Solid 2 with the same DOM and ARIA as
 * `Collapsible.Root` / `.Trigger` / `.Panel` render by default (no animation measurement, no
 * controlled-state plumbing). Cost tests compare each part against its floor counterpart of the
 * same shape, so the dev runtime's per-component nodes are on both sides.
 */
import { Show, createContext, createSignal, createUniqueId, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';

interface FloorCollapsible {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
  panelId: string;
}

const FloorContext = createContext<FloorCollapsible>();

export function FloorCollapsibleRoot(props: { defaultOpen?: boolean; children?: JSX.Element }) {
  // The default is read once, as an uncontrolled default.
  const [open, setOpen] = createSignal(props.defaultOpen ?? false);
  const value: FloorCollapsible = { open, setOpen, panelId: createUniqueId() };
  return (
    <FloorContext value={value}>
      <div data-open={open() ? '' : undefined} data-closed={open() ? undefined : ''}>
        {props.children}
      </div>
    </FloorContext>
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
  return (
    <Show when={root.open()}>
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
    </Show>
  );
}
