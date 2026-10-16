/*
 * The hand-written Solid floor for Collapsible: the fewest reactive nodes plain Solid 2 needs for the
 * same DOM and ARIA as `Collapsible.Root` / `.Trigger` / `.Panel` render by default. On the client
 * context rides one transparent owner (no JSX provider); the server uses the provider, since its
 * owners are not `@solidjs/signals`'s, and hydration rebuilds the provider's owners. The panel
 * renders through `conditional` (a root per shown branch, no `<Show>` memos), which keeps its
 * hydration keys where the server put them. Cost tests and the bench compare the parts against it: the exit
 * bar is at most the floor plus 25%.
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
import { conditional } from './conditional';

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
  if (isServer) {
    return <FloorContext value={value}>{render()}</FloorContext>;
  }
  if (isHydrating()) {
    // The server provider's owners that hydration ids depend on, without its computations: its
    // root and its children memo (GOTCHA-017).
    const root = createOwner();
    setContext(FloorContext, value, root);
    return runWithOwner(
      runWithOwner(root, () => createOwner()),
      render,
    );
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
  return conditional(
    () => root.open(),
    () => (
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
    ),
  ) as unknown as JSX.Element;
}
