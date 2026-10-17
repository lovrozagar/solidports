import { createMemo } from 'solid-js';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const PANEL_CONTENT = 'This is panel content';

/** A sibling after the panel that takes hydration ids: a memo and an element under it. */
function IdSibling() {
  const label = createMemo(() => 'sibling');
  return <span data-testid="sibling" title={label()} />;
}

export default defineSsrFixtures(import.meta.url, {
  // The server state (D9): the root's, trigger's and panel's server attributes equal the client's.
  open: () => (
    <Collapsible.Root data-testid="root" defaultOpen>
      <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel">{PANEL_CONTENT}</Collapsible.Panel>
    </Collapsible.Root>
  ),
  keepMountedClosed: () => (
    <Collapsible.Root data-testid="root">
      <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel" keepMounted>
        {PANEL_CONTENT}
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  hiddenUntilFoundClosed: () => (
    <Collapsible.Root data-testid="root">
      <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel" hiddenUntilFound>
        {PANEL_CONTENT}
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  openRootBeforeIdSibling: () => (
    <>
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>{PANEL_CONTENT}</Collapsible.Panel>
      </Collapsible.Root>
      <IdSibling />
    </>
  ),
  openBeforeIdSibling: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel">{PANEL_CONTENT}</Collapsible.Panel>
      <IdSibling />
    </Collapsible.Root>
  ),
  keyframes: () => (
    <>
      <style>{`
        @keyframes panel-slide-down {
          from {
            height: 0;
          }

          to {
            height: var(--collapsible-panel-height);
          }
        }

        .animation-test-panel[data-open] {
          animation: panel-slide-down 100ms linear;
        }
      `}</style>

      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel class="animation-test-panel" data-testid="panel">
          {PANEL_CONTENT}
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
  inlineKeyframes: () => (
    <>
      <style>{`
        @keyframes panel-slide-down {
          from {
            height: 0;
          }

          to {
            height: var(--collapsible-panel-height);
          }
        }
      `}</style>

      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel
          data-testid="panel"
          style={{
            'animation-duration': '100ms',
            'animation-name': 'panel-slide-down',
            'animation-timing-function': 'linear',
          }}
        >
          {PANEL_CONTENT}
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  ),
});
