import { createSignal, merge, omit } from 'solid-js';
import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '../../../test/floor/collapsible';

// Collapsible renders natively on the server and while hydrating, and falls back to
// `useRenderElement` for some props. The choice must come out the same on both sides, or every
// hydration key after the part shifts: each shape below hydrates with every node claimed.

/** A consumer component in `render`: forwards every prop, the ref included, to a tag. */
const AppButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => <button {...props} />;
const AppSection = (props: JSX.HTMLAttributes<HTMLElement>) => <section {...props} />;
/** The same components dropping the ref: the part cannot reach the element through them. */
const NoRefButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => (
  <button {...omit(props, 'ref')} />
);
const NoRefSection = (props: JSX.HTMLAttributes<HTMLElement>) => (
  <section {...omit(props, 'ref')} />
);

export default defineSsrFixtures(import.meta.url, {
  // The hand-written floor the bench measures hydration against: it must hydrate cleanly too.
  floor: () => (
    <FloorCollapsibleRoot defaultOpen>
      <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
      <FloorCollapsiblePanel>Contents</FloorCollapsiblePanel>
    </FloorCollapsibleRoot>
  ),
  nativeClosed: () => (
    <Collapsible.Root>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  nativeOpen: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  renderProp: () => (
    <Collapsible.Root defaultOpen render={(props) => <section {...props} />}>
      <Collapsible.Trigger render={(props) => <span {...props} />} nativeButton={false}>
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel render={(props) => <article {...props} />}>Content</Collapsible.Panel>
    </Collapsible.Root>
  ),
  reactiveRef: () => {
    // A ref behind a getter (a spread source): not static, unlike a `ref={…}` attribute, which the
    // compiler reads once.
    const [version] = createSignal(0);
    const divRef = {
      get ref() {
        version();
        return (_element: HTMLDivElement | null) => {};
      },
    };
    const buttonRef = {
      get ref() {
        version();
        return (_element: HTMLButtonElement | null) => {};
      },
    };
    return (
      <Collapsible.Root defaultOpen {...divRef}>
        <Collapsible.Trigger {...buttonRef}>Toggle</Collapsible.Trigger>
        <Collapsible.Panel {...divRef}>Content</Collapsible.Panel>
      </Collapsible.Root>
    );
  },
  mergeProxy: () => {
    const [extra] = createSignal(false);
    const rootProps = merge(() => (extra() ? { disabled: true } : {}), { defaultOpen: true });
    const panelProps = merge(() => (extra() ? { keepMounted: true } : {}));
    return (
      <Collapsible.Root {...rootProps}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel {...panelProps}>Content</Collapsible.Panel>
      </Collapsible.Root>
    );
  },
  reactivePanelId: () => {
    // A reactive `id`: the panel registers it with the root from a memo and an effect.
    const [id] = createSignal('reactive-panel');
    return (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel id={id()}>Content</Collapsible.Panel>
      </Collapsible.Root>
    );
  },
  openedDuringHydration: () => {
    // The server renders the root closed; the client opens it while hydrating (from a later
    // element's ref, which runs inside `hydrate()`), when Solid skips attribute writes. The
    // parts must end up with the open attributes.
    const [open, setOpen] = createSignal(false);
    return (
      <>
        <Collapsible.Root open={open()} data-testid="root">
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        </Collapsible.Root>
        <span
          ref={() => {
            if (!isServer) {
              setOpen(true);
            }
          }}
        />
      </>
    );
  },
  mixedTree: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger render={(props) => <button type="button" {...props} />}>
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel>Content</Collapsible.Panel>
      <Collapsible.Root>
        <Collapsible.Trigger>Nested</Collapsible.Trigger>
        <Collapsible.Panel render={(props) => <div {...props} />}>Nested content</Collapsible.Panel>
      </Collapsible.Root>
    </Collapsible.Root>
  ),
  // The three `render` values the port takes (plan 3 leaf 5.1.2) on the Trigger and the Panel:
  // the client must claim the server's elements, not recreate them.
  renderTag: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger render="button" data-testid="trigger">
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel render="section" keepMounted data-testid="panel">
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  renderConfig: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger
        render={{ component: 'button', 'data-source': 'config' }}
        data-testid="trigger"
      >
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel
        render={{ component: 'section', 'data-source': 'config' }}
        keepMounted
        data-testid="panel"
      >
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  renderComponent: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger render={{ component: AppButton }} data-testid="trigger">
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel render={{ component: AppSection }} keepMounted data-testid="panel">
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  renderComponentNoRef: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger render={{ component: NoRefButton }} data-testid="trigger">
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel render={{ component: NoRefSection }} keepMounted data-testid="panel">
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  renderFunction: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger
        render={(props, state) => <button {...props} data-render-open={String(state.open)} />}
        data-testid="trigger"
      >
        Toggle
      </Collapsible.Trigger>
      <Collapsible.Panel
        render={(props, state) => <section {...props} data-render-open={String(state.open)} />}
        keepMounted
        data-testid="panel"
      >
        Content
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
});
