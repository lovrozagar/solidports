/*
 * Accordion against its hand-written Solid floor (`test/floor/accordion.tsx`): reactive nodes (owners
 * and computations, the dev `onOwner` hook) one more copy of a shape adds, compared part by part
 * with the floor counterpart of the same shape. Both sides are components, so the dev runtime's
 * per-component nodes cancel out (plan 3, Accordion after the Collapsible pilot).
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import {
  FloorAccordionHeader,
  FloorAccordionItem,
  FloorAccordionPanel,
  FloorAccordionRoot,
  FloorAccordionTrigger,
} from '../../test/floor/accordion';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

describe('accordion cost against the hand-written floor', () => {
  const { render } = createRenderer();

  function nodes(ui: () => JSX.Element) {
    count = 0;
    hooks.onOwner = counting;
    const view = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    view.unmount();
    return created;
  }

  /** Nodes one more item adds next to one item, inside one root. */
  const perItem = (root: (items: () => JSX.Element) => JSX.Element, item: () => JSX.Element) =>
    nodes(() =>
      root(() => (
        <>
          {item()}
          {item()}
        </>
      )),
    ) - nodes(() => root(item));

  const partRoot = (open: boolean) => (items: () => JSX.Element) => (
    <Accordion.Root defaultValue={open ? ['a'] : []} multiple>
      {items()}
    </Accordion.Root>
  );
  const floorRoot = (open: boolean) => (items: () => JSX.Element) => (
    <FloorAccordionRoot defaultValue={open ? ['a'] : []} multiple>
      {items()}
    </FloorAccordionRoot>
  );

  const part = {
    item: () => <Accordion.Item value="a" />,
    header: () => (
      <Accordion.Item value="a">
        <Accordion.Header />
      </Accordion.Item>
    ),
    trigger: () => (
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger>Toggle</Accordion.Trigger>
        </Accordion.Header>
      </Accordion.Item>
    ),
    full: () => (
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger>Toggle</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Content</Accordion.Panel>
      </Accordion.Item>
    ),
  };
  const floor = {
    item: () => <FloorAccordionItem value="a" />,
    header: () => (
      <FloorAccordionItem value="a">
        <FloorAccordionHeader />
      </FloorAccordionItem>
    ),
    trigger: () => (
      <FloorAccordionItem value="a">
        <FloorAccordionHeader>
          <FloorAccordionTrigger>Toggle</FloorAccordionTrigger>
        </FloorAccordionHeader>
      </FloorAccordionItem>
    ),
    full: () => (
      <FloorAccordionItem value="a">
        <FloorAccordionHeader>
          <FloorAccordionTrigger>Toggle</FloorAccordionTrigger>
        </FloorAccordionHeader>
        <FloorAccordionPanel>Content</FloorAccordionPanel>
      </FloorAccordionItem>
    ),
  };

  it('the floor renders the same DOM as Accordion, closed and open', () => {
    // Canonical DOM: tag, sorted attributes (ids replaced, style by property), then children, so
    // attribute order and style serialization do not count.
    const canonical = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
      }
      const el = node as HTMLElement;
      const attrs = [...el.attributes]
        .map((attr) => {
          if (attr.name === 'style') {
            const props = [...el.style].map((name) => `${name}:${el.style.getPropertyValue(name)}`);
            return `style=${props.sort().join(';')}`;
          }
          if (['id', 'aria-controls', 'aria-labelledby'].includes(attr.name)) {
            return attr.name;
          }
          return `${attr.name}=${attr.value}`;
        })
        .sort();
      return `<${el.tagName.toLowerCase()} ${attrs.join(' ')}>${[...el.childNodes].map(canonical).join('')}</>`;
    };
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      const out = [...view.container.childNodes].map(canonical).join('');
      view.unmount();
      return out;
    };
    for (const open of [false, true]) {
      expect(html(() => floorRoot(open)(floor.full))).toBe(html(() => partRoot(open)(part.full)));
    }
  });

  const parts = [
    ['an Item', 'item', undefined],
    ['a Header', 'header', 'item'],
    ['a Trigger', 'trigger', 'header'],
    ['a closed Panel', 'full', 'trigger'],
  ] as const;

  for (const [name, shape, below] of parts) {
    it(`${name} costs at most the floor's plus 25%`, () => {
      const cost =
        perItem(partRoot(false), part[shape]) -
        (below ? perItem(partRoot(false), part[below]) : 0);
      const budget =
        perItem(floorRoot(false), floor[shape]) -
        (below ? perItem(floorRoot(false), floor[below]) : 0);
      expect(cost, `${name} ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
        Math.floor(budget * 1.25),
      );
    });
  }

  it('an open item costs at most the open floor item plus 25%', () => {
    const cost = perItem(partRoot(true), part.full);
    const budget = perItem(floorRoot(true), floor.full);
    expect(cost, `open item ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });
});
