/*
 * The hand-written Solid floor for Collapsible: the fewest reactive nodes plain Solid 2 needs for the
 * same DOM and ARIA as `Collapsible.Root` / `.Trigger` / `.Panel` render by default. On the client
 * context rides one transparent owner (no JSX provider); the server and hydration use the provider,
 * since the server's owners are not `@solidjs/signals`'s. The panel is a plain conditional (no
 * `<Show>`). Cost tests and the bench compare the parts against it: the exit bar is at most the
 * floor plus 25%.
 */
import {
  createContext,
  createOwner,
  createSignal,
  createUniqueId,
  isHydrating,
  runWithOwner,
  useContext,
} from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
// `solid-js` does not re-export `setContext`; `@solidjs/signals` is the same core in the browser.
import { setContext } from '@solidjs/signals';

interface FloorCollapsible {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
  panelId: string;
}

const FloorContext = createContext<FloorCollapsible>();

export function FloorCollapsibleRoot(props: {
  open?: boolean;
  defaultOpen?: boolean;
  children?: JSX.Element;
}) {
  // The default is read once, as an uncontrolled default; `open` controls when set.
  const [internalOpen, setOpen] = createSignal(props.defaultOpen ?? false);
  const open = () => props.open ?? internalOpen();
  const value = { open, setOpen, panelId: createUniqueId() };
  return (
    <div data-open={open() ? '' : undefined} data-closed={open() ? undefined : ''}>
      {provideFloorContext(value, () => props.children)}
    </div>
  );
}

function provideFloorContext(value: FloorCollapsible, render: () => JSX.Element) {
  if (isServer || isHydrating()) {
    return <FloorContext value={value}>{render()}</FloorContext>;
  }
  const owner = createOwner({ transparent: true });
  setContext(FloorContext, value, owner);
  return runWithOwner(owner, render);
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
