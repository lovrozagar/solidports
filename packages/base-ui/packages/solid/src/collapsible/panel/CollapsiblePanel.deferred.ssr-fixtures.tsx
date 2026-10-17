import { createSignal } from 'solid-js';
import { isServer } from '@solidjs/web';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

/**
 * Panels that render open with a height transition: an initially open native panel builds its
 * client machinery on its first change (D11), so a close right after hydration must run as it does
 * for a panel the client has had open for a while.
 */
export const TRANSITION_STYLE = `
  .deferred-panel { overflow: hidden; height: var(--collapsible-panel-height); transition: height 40ms linear; }
  .deferred-panel[data-starting-style], .deferred-panel[data-ending-style] { height: 0; }
`;

/** The controlled fixture's `open`. */
export const [controlledOpen, setControlledOpen] = createSignal(true);

export default defineSsrFixtures(import.meta.url, {
  openKeepMounted: () => (
    <>
      <style>{TRANSITION_STYLE}</style>
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
        <Collapsible.Panel class="deferred-panel" data-testid="panel" keepMounted>
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
  openUnmounts: () => (
    <>
      <style>{TRANSITION_STYLE}</style>
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
        <Collapsible.Panel class="deferred-panel" data-testid="panel">
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
  openHiddenUntilFound: () => (
    <>
      <style>{TRANSITION_STYLE}</style>
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
        <Collapsible.Panel class="deferred-panel" data-testid="panel" hiddenUntilFound>
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
  openControlled: () => (
    <>
      <style>{TRANSITION_STYLE}</style>
      <Collapsible.Root open={controlledOpen()} onOpenChange={setControlledOpen}>
        <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
        <Collapsible.Panel class="deferred-panel" data-testid="panel" keepMounted>
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
  closedDuringHydration: () => {
    // The server renders the panel open; the client closes it while hydrating (from a later
    // element's ref, which runs inside `hydrate()`). The change reaches the panel at the flush after
    // `hydrate()` returns, which builds its machinery in its lazy scope. The sibling root's ids,
    // taken after the panel, must still match the server's.
    const [open, setOpen] = createSignal(true);
    return (
      <>
        <style>{TRANSITION_STYLE}</style>
        <Collapsible.Root open={open()} onOpenChange={setOpen} data-testid="root">
          <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
          <Collapsible.Panel class="deferred-panel" data-testid="panel" keepMounted>
            Content
          </Collapsible.Panel>
        </Collapsible.Root>
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger data-testid="sibling-trigger">Sibling</Collapsible.Trigger>
          <Collapsible.Panel data-testid="sibling-panel">Sibling content</Collapsible.Panel>
        </Collapsible.Root>
        <span
          ref={() => {
            if (!isServer) {
              setOpen(false);
            }
          }}
        />
      </>
    );
  },
});
