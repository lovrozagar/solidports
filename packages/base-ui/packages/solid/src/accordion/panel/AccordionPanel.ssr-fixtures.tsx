import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Accordion } from '@solidports/base-ui/accordion';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const PANEL_CONTENT = 'This is panel content';

/** A sibling after the panel that takes hydration ids: a memo and an element under it. */
function IdSibling() {
  const label = createMemo(() => 'sibling');
  return <span data-testid="sibling" title={label()} />;
}

/** One item whose panel `panel` renders, open when `open`, followed by `after`. */
function Item(props: {
  open?: boolean | undefined;
  panel: (content: string) => JSX.Element;
  after?: JSX.Element | undefined;
}) {
  return (
    <Accordion.Root defaultValue={props.open ? [0] : []}>
      <Accordion.Item data-testid="root" value={0}>
        <Accordion.Header>
          <Accordion.Trigger data-testid="trigger">Trigger</Accordion.Trigger>
        </Accordion.Header>
        {props.panel(PANEL_CONTENT)}
        {props.after}
      </Accordion.Item>
    </Accordion.Root>
  );
}

export default defineSsrFixtures(import.meta.url, {
  // The server state (D9): the item's, trigger's and panel's server attributes equal the client's.
  open: () => (
    <Item open panel={(content) => <Accordion.Panel data-testid="panel">{content}</Accordion.Panel>} />
  ),
  keepMountedClosed: () => (
    <Item
      panel={(content) => (
        <Accordion.Panel data-testid="panel" keepMounted>
          {content}
        </Accordion.Panel>
      )}
    />
  ),
  hiddenUntilFoundClosed: () => (
    <Item
      panel={(content) => (
        <Accordion.Panel data-testid="panel" hiddenUntilFound>
          {content}
        </Accordion.Panel>
      )}
    />
  ),
  openBeforeIdSibling: () => (
    <Item
      open
      panel={(content) => <Accordion.Panel data-testid="panel">{content}</Accordion.Panel>}
      after={<IdSibling />}
    />
  ),
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
