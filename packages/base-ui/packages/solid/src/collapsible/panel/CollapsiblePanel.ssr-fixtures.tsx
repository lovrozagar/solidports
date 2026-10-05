import { Collapsible } from '@solidports/base-ui/collapsible';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const PANEL_CONTENT = 'This is panel content';

export default defineSsrFixtures(import.meta.url, {
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
