/*
 * The hand-written Solid floor for Collapsible: the fewest reactive nodes plain Solid 2 needs for the
 * same DOM and ARIA as `Collapsible.Root` / `.Trigger` / `.Panel` render by default. On the client
 * context rides one transparent owner (no JSX provider); the server uses the provider, since its
 * owners are not `@solidjs/signals`'s, and hydration rebuilds the provider's owners. The panel
 * renders through `conditional` (a root per shown branch, no `<Show>` memos), which keeps its
 * hydration keys where the server put them. Opening holds `data-starting-style` on the root and
 * the trigger for a frame, and on the panel too when it has motion, which also measures the panel
 * until its transition ends (`./motion.ts`, D19). Cost
 * tests and the bench compare the parts against it: the exit bar is at most the floor plus 25%.
 */
import {
  createContext,
  createOwner,
  createSignal,
  createUniqueId,
  isHydrating,
  onCleanup,
  runWithOwner,
  untrack,
  useContext,
} from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
// `solid-js` does not re-export `setContext`; `@solidjs/signals` is the same core in the browser.
import { setContext } from '@solidjs/signals';
import { conditional } from './conditional';
import { afterNextFrame, openPanel, releaseAfterAnimations, sizeVar } from './motion';
import type { PanelSize } from './motion';

interface FloorCollapsible {
  open: Accessor<boolean>;
  setOpen: Setter<boolean>;
  /** `'starting'` from an open until the task after the next frame. */
  status: Accessor<'starting' | undefined>;
  /** Runs `callback` where `'starting'` ends, after the write that ends it (once). */
  whenStartingEnds: (callback: () => void) => void;
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
  // The function form follows a controlled `open` too: one computation, created at mount.
  let wasOpen: boolean | undefined;
  let cancelFrame: (() => void) | undefined;
  let startingEnds: (() => void) | undefined;
  const [status, setStatus] = createSignal<'starting' | undefined>((prev) => {
    const isOpen = open();
    if (isOpen === wasOpen) {
      return prev;
    }
    const mounting = wasOpen === undefined;
    wasOpen = isOpen;
    cancelFrame?.();
    cancelFrame = undefined;
    startingEnds = undefined;
    // Content that mounts open skips `'starting'`; a close ends it at once (no ending style).
    if (!isOpen || mounting) {
      return undefined;
    }
    cancelFrame = afterNextFrame(() => {
      cancelFrame = undefined;
      setStatus(undefined);
      const ended = startingEnds;
      startingEnds = undefined;
      ended?.();
    });
    return 'starting';
  });
  onCleanup(() => cancelFrame?.());
  const value: FloorCollapsible = {
    open,
    setOpen,
    status,
    whenStartingEnds: (callback) => {
      startingEnds = callback;
    },
    panelId: createUniqueId(),
  };
  return (
    <div
      data-open={open() ? '' : undefined}
      data-closed={open() ? undefined : ''}
      data-starting-style={status() === 'starting' ? '' : undefined}
    >
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
      data-starting-style={root.status() === 'starting' ? '' : undefined}
      onClick={() => root.setOpen((open) => !open)}
    >
      {props.children}
    </button>
  );
}

export function FloorCollapsiblePanel(props: { children?: JSX.Element }) {
  const root = useContext(FloorContext)!;
  // A panel that mounts open suppresses its open animation until it first closes.
  let mountedOpen = untrack(root.open);
  return conditional(
    () => root.open(),
    () => {
      const suppressAnimation = mountedOpen;
      mountedOpen = false;
      // The panel holds the root's `'starting'` unless it has no motion, read once before paint;
      // with motion it holds its measured size until its transition ends.
      const [idle, setIdle] = createSignal(false);
      const [size, setSize] = createSignal<PanelSize>();
      let panel: HTMLDivElement | undefined;
      if (untrack(root.status) === 'starting') {
        openPanel(
          () => panel,
          () => setIdle(true),
          (measured) => {
            setSize(measured);
            root.whenStartingEnds(() =>
              releaseAfterAnimations(
                () => panel,
                () => setSize(undefined),
              ),
            );
          },
        );
      }
      return (
        <div
          ref={(el) => {
            panel = el;
          }}
          data-open=""
          data-starting-style={root.status() === 'starting' && !idle() ? '' : undefined}
          id={root.panelId}
          style={{
            'animation-name': suppressAnimation ? 'none' : undefined,
            '--collapsible-panel-height': sizeVar(size(), 'height'),
            '--collapsible-panel-width': sizeVar(size(), 'width'),
          }}
        >
          {props.children}
        </div>
      );
    },
  ) as unknown as JSX.Element;
}
