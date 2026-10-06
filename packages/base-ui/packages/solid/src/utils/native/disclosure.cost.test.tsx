/*
 * Cost budgets for the native disclosure parts (plan 8 step 3.2): reactive nodes (owners and
 * computations, Solid's dev `onOwner` hook) one more copy of a part adds next to the same tree,
 * beyond a plain element in the same position. The dev runtime wraps every component in one
 * root (`observedComponent`, not in production): each part's floor beyond its element is 1.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Tabs } from '@solidports/base-ui/tabs';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

describe('native disclosure part cost', () => {
  const { render } = createRenderer();

  function nodes(ui: () => JSX.Element) {
    count = 0;
    hooks.onOwner = counting;
    const result = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    result.unmount();
    return created;
  }

  /**
   * Nodes one extra copy of `item` adds inside `wrap` (includes the parent's insert). `wrap`
   * receives a getter so the items are created inside the wrapper (its contexts).
   */
  function perItem(
    wrap: (items: () => JSX.Element) => JSX.Element,
    item: (index: number) => JSX.Element,
  ) {
    const one = nodes(() => wrap(() => item(0)));
    const two = nodes(() => wrap(() => [item(0), item(1)] as unknown as JSX.Element));
    return two - one;
  }

  const plainDiv = () => <div />;

  it('a closed Collapsible (Root + Trigger + Panel) costs at most 12 nodes (dev)', () => {
    // 3 dev component roots; root: uncontrolled `open` signal + 2 dev `useControlled` effects,
    // panel id signal, context owner, attribute effect, children insert (the transition status is
    // created on first open); trigger: attribute effect; panel: 2 dev warning nodes (the
    // conditional branch costs no node until it renders). Production: 7.
    const BUDGET = 12;
    const cost = perItem(
      (items) => <div>{items()}</div>,
      () => (
        <Collapsible.Root>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>Content</Collapsible.Panel>
        </Collapsible.Root>
      ),
    );
    const floor = perItem((items) => <div>{items()}</div>, plainDiv);
    expect(cost - floor, `closed collapsible: ${cost - floor} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('an open Collapsible (Root + Trigger + rendered Panel) costs at most 18 nodes (dev)', () => {
    // The closed budget plus the rendered panel: conditional branch root, attribute effect,
    // children insert, forced-idle signal, one effect node for measure/complete/close, and the
    // root's transition status (2 signals + 1 effect node). Production: 11.
    const BUDGET = 18;
    const cost = perItem(
      (items) => <div>{items()}</div>,
      () => (
        <Collapsible.Root defaultOpen>
          <Collapsible.Trigger>Toggle</Collapsible.Trigger>
          <Collapsible.Panel>Content</Collapsible.Panel>
        </Collapsible.Root>
      ),
    );
    const floor = perItem((items) => <div>{items()}</div>, plainDiv);
    expect(cost - floor, `open collapsible: ${cost - floor} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('a closed Accordion item (Item + Header + Trigger + Panel) costs at most 14 nodes (dev)', () => {
    // 4 dev roots; item: open memo, panel + trigger id signals, index signal, one context owner,
    // attribute effect, children insert; header: attribute effect + children insert; trigger:
    // attribute effect; panel: 2 dev warning nodes. Production: 10.
    const BUDGET = 14;
    const cost = perItem(
      (items) => <Accordion.Root>{items()}</Accordion.Root>,
      (index) => (
        <Accordion.Item value={index}>
          <Accordion.Header>
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      ),
    );
    const floor = perItem((items) => <Accordion.Root>{items()}</Accordion.Root>, plainDiv);
    expect(cost - floor, `closed accordion item: ${cost - floor} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('a Tab and its hidden Panel cost at most 4 nodes together (dev)', () => {
    // Tab: dev root, attribute effect, highlight-sync effect (index signal counted with the list);
    // hidden panel: dev root only (its conditional branch and machinery exist once it renders).
    const BUDGET = 4;
    const cost = perItem(
      (items) => (
        <Tabs.Root defaultValue="zz">
          <Tabs.List>{items()}</Tabs.List>
        </Tabs.Root>
      ),
      (index) => <Tabs.Tab value={index}>Tab</Tabs.Tab>,
    );
    const floor = perItem(
      (items) => (
        <Tabs.Root defaultValue="zz">
          <Tabs.List>{items()}</Tabs.List>
        </Tabs.Root>
      ),
      plainDiv,
    );
    const panelCost = perItem(
      (items) => <Tabs.Root defaultValue="zz">{items()}</Tabs.Root>,
      (index) => <Tabs.Panel value={index}>Panel</Tabs.Panel>,
    );
    const panelFloor = perItem((items) => <Tabs.Root defaultValue="zz">{items()}</Tabs.Root>, plainDiv);
    const tab = cost - floor;
    const panel = panelCost - panelFloor;
    expect(tab + panel, `tab ${tab} + hidden panel ${panel} nodes beyond plain divs`).toBeLessThanOrEqual(BUDGET);
  });
});
