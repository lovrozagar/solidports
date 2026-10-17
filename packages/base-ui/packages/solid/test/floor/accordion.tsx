/*
 * The hand-written Solid floor for Accordion: the fewest reactive nodes plain Solid 2 needs for the
 * same DOM and ARIA as `Accordion.Root` / `.Item` / `.Header` / `.Trigger` / `.Panel` render by
 * default (vertical, items open by value, a closed panel unmounted), under the same contract:
 * each item provides its collapsible root and itself, as two contexts. On the client a context
 * rides a transparent owner; the server uses the provider, since its owners are not
 * `@solidjs/signals`'s, and hydration rebuilds the provider's owners (GOTCHA-017). An item's index
 * is its creation order on every side, as the parts guess it. Cost tests and the bench compare the parts against it: the exit bar is at most
 * the floor plus 25%.
 */
import {
  createComponent,
  createContext,
  createMemo,
  createOwner,
  createSignal,
  createUniqueId,
  isHydrating,
  runWithOwner,
  useContext,
} from 'solid-js';
import type { Accessor, Context } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
// `solid-js` does not re-export `setContext`; `@solidjs/signals` is the same core in the browser.
import { setContext } from '@solidjs/signals';
import { conditional } from './conditional';

interface FloorRoot {
  value: Accessor<readonly string[]>;
  /** Whether `item` is open: one set per root value, so a read is constant time. */
  isOpen: (item: string) => boolean;
  toggle: (item: string, open: boolean) => void;
  nextIndex: () => number;
}

interface FloorItem {
  open: Accessor<boolean>;
  index: Accessor<number>;
  value: string;
  triggerId: string;
  panelId: string;
  toggle: () => void;
}

const RootContext = createContext<FloorRoot>();
const ItemContext = createContext<FloorItem>();
/**
 * The item's collapsible root, as `Accordion.Item` provides `CollapsibleRootContext` so Collapsible
 * parts work inside an item (upstream's contract). The item object is its value: the floor pays
 * for the provision, not for a second object.
 */
const CollapsibleContext = createContext<FloorItem>();

/** Renders `render` with `context = value`: one transparent owner, or the server's provider shape. */
function provide<T>(context: Context<T>, value: T, render: () => JSX.Element): JSX.Element {
  if (isServer) {
    const Provider = context as unknown as (props: {
      value: T;
      children: JSX.Element;
    }) => JSX.Element;
    return createComponent(Provider, {
      value,
      get children() {
        return render();
      },
    });
  }
  if (isHydrating()) {
    // The server provider's owners that hydration ids depend on: its root and its children memo.
    const root = createOwner();
    setContext(context, value, root);
    return runWithOwner(
      runWithOwner(root, () => createOwner()),
      render,
    );
  }
  const owner = createOwner({ transparent: true });
  setContext(context, value, owner);
  return runWithOwner(owner, render);
}

/** `provide` for two contexts: one owner on the client, the server's two nested providers. */
function provideTwo<A, B>(
  contextA: Context<A>,
  valueA: A,
  contextB: Context<B>,
  valueB: B,
  render: () => JSX.Element,
): JSX.Element {
  if (isServer || isHydrating()) {
    return provide(contextA, valueA, () => provide(contextB, valueB, render));
  }
  const owner = createOwner({ transparent: true });
  setContext(contextA, valueA, owner);
  setContext(contextB, valueB, owner);
  return runWithOwner(owner, render);
}

export function FloorAccordionRoot(props: {
  value?: readonly string[];
  defaultValue?: readonly string[];
  multiple?: boolean;
  children?: JSX.Element;
}) {
  // The default is read once, as an uncontrolled default; `value` controls when set.
  const [internalValue, setValue] = createSignal<readonly string[]>(props.defaultValue ?? []);
  const value = () => props.value ?? internalValue();
  const openItems = createMemo(() => new Set(value()));
  let count = 0;
  const root: FloorRoot = {
    value,
    isOpen: (item) => openItems().has(item),
    toggle: (item, open) => {
      const current = value();
      if (open) {
        setValue(props.multiple ? [...current, item] : [item]);
      } else {
        setValue(current.filter((entry) => entry !== item));
      }
    },
    nextIndex: () => {
      count += 1;
      return count - 1;
    },
  };
  return (
    <div data-orientation="vertical">{provide(RootContext, root, () => props.children)}</div>
  );
}

export function FloorAccordionItem(props: { value: string; children?: JSX.Element }) {
  const root = useContext(RootContext)!;
  const open = () => root.isOpen(props.value);
  // The item's index is its creation order, the same on the server and the hydrating client.
  const created = root.nextIndex();
  const index = () => created;
  const item: FloorItem = {
    open,
    index,
    value: props.value,
    triggerId: createUniqueId(),
    panelId: createUniqueId(),
    toggle: () => root.toggle(props.value, !open()),
  };
  return (
    <div
      data-orientation="vertical"
      data-hidden={open() ? undefined : ''}
      data-index={index()}
      data-open={open() ? '' : undefined}
      data-closed={open() ? undefined : ''}
    >
      {provideTwo(CollapsibleContext, item, ItemContext, item, () => props.children)}
    </div>
  );
}

export function FloorAccordionHeader(props: { children?: JSX.Element }) {
  const item = useContext(ItemContext)!;
  return (
    <h3
      data-orientation="vertical"
      data-hidden={item.open() ? undefined : ''}
      data-index={item.index()}
      data-open={item.open() ? '' : undefined}
      data-closed={item.open() ? undefined : ''}
    >
      {props.children}
    </h3>
  );
}

export function FloorAccordionTrigger(props: { children?: JSX.Element }) {
  const item = useContext(ItemContext)!;
  return (
    <button
      type="button"
      tabindex="0"
      data-orientation="vertical"
      data-hidden={item.open() ? undefined : ''}
      data-index={item.index()}
      data-panel-open={item.open() ? '' : undefined}
      aria-controls={item.open() ? item.panelId : undefined}
      aria-expanded={item.open() ? 'true' : 'false'}
      id={item.triggerId}
      onClick={item.toggle}
    >
      {props.children}
    </button>
  );
}

export function FloorAccordionPanel(props: { children?: JSX.Element }) {
  const item = useContext(ItemContext)!;
  return conditional(
    () => item.open(),
    () => (
      <div
        data-orientation="vertical"
        data-index={item.index()}
        data-open=""
        id={item.panelId}
        aria-labelledby={item.triggerId}
        role="region"
        style={{
          '--accordion-panel-height': 'auto',
          '--accordion-panel-width': 'auto',
          'animation-name': 'none',
        }}
      >
        {props.children}
      </div>
    ),
  ) as unknown as JSX.Element;
}
