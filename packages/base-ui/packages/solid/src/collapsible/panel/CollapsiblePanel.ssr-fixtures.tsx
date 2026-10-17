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
  // The panel's server state (D9): each panel's server attributes equal the client's first render.
  open: () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel">{PANEL_CONTENT}</Collapsible.Panel>
    </Collapsible.Root>
  ),
  keepMountedClosed: () => (
    <Collapsible.Root>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel" keepMounted>
        {PANEL_CONTENT}
      </Collapsible.Panel>
    </Collapsible.Root>
  ),
  hiddenUntilFoundClosed: () => (
    <Collapsible.Root>
      <Collapsible.Trigger>Trigger</Collapsible.Trigger>
      <Collapsible.Panel data-testid="panel" hiddenUntilFound>
        {PANEL_CONTENT}
      </Collapsible.Panel>
    </Collapsible.Root>
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
