import { createSignal, For } from 'solid-js';
import { isServer } from '@solidjs/web';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/** Closed Collapsibles (root and trigger), unchanged by hydration, for `hydrationCost.test.tsx`. */
function Closed(props: { count: number }) {
  return (
    <For each={Array.from({ length: props.count }, (_, index) => index)}>
      {() => (
        <Collapsible.Root data-testid="root">
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel>Content</Collapsible.Panel>
        </Collapsible.Root>
      )}
    </For>
  );
}

/** Closed panels kept mounted, whose machinery runs while hydrating: they reconcile. */
function KeptPanels(props: { count: number }) {
  return (
    <For each={Array.from({ length: props.count }, (_, index) => index)}>
      {() => (
        <Collapsible.Root>
          <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          <Collapsible.Panel data-testid="panel" keepMounted>
            Content
          </Collapsible.Panel>
        </Collapsible.Root>
      )}
    </For>
  );
}

/** Collapsibles the client opens while hydrating (from a later element's ref). */
function OpenedWhileHydrating(props: { count: number }) {
  const [open, setOpen] = createSignal(false);
  return (
    <>
      <For each={Array.from({ length: props.count }, (_, index) => index)}>
        {() => (
          <Collapsible.Root open={open()} data-testid="root">
            <Collapsible.Trigger>Trigger</Collapsible.Trigger>
          </Collapsible.Root>
        )}
      </For>
      <span
        ref={() => {
          if (!isServer) {
            setOpen(true);
          }
        }}
      />
    </>
  );
}

/** A value the server and the client compute differently, as a `matchMedia` or locale read. */
const environment = () => (isServer ? 'server' : 'client');

export default defineSsrFixtures(import.meta.url, {
  environment: () => (
    <>
      <Collapsible.Root data-testid="root" data-environment={environment()}>
        <Collapsible.Trigger data-testid="trigger" data-environment={environment()}>
          Trigger
        </Collapsible.Trigger>
      </Collapsible.Root>
      <div data-testid="plain" data-environment={environment()} />
    </>
  ),
  closed1: () => <Closed count={1} />,
  closed10: () => <Closed count={10} />,
  panels1: () => <KeptPanels count={1} />,
  panels10: () => <KeptPanels count={10} />,
  opened1: () => <OpenedWhileHydrating count={1} />,
  opened10: () => <OpenedWhileHydrating count={10} />,
});
