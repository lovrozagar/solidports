import { Accordion } from '@solidports/base-ui/accordion';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const PANEL_CONTENT = 'This is panel content';

export default defineSsrFixtures(import.meta.url, {
  inlineKeyframes: () => (
    <>
      <style>{`
        @keyframes panel-slide-down {
          from {
            height: 0;
          }

          to {
            height: var(--accordion-panel-height);
          }
        }
      `}</style>

      <Accordion.Root defaultValue={[0]}>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel
            data-testid="panel"
            style={{
              'animation-duration': '100ms',
              'animation-name': 'panel-slide-down',
              'animation-timing-function': 'linear',
            }}
          >
            {PANEL_CONTENT}
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    </>
  ),
});
