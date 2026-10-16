/*
 * Collapsible against its hand-written Solid floor (`test/floor/collapsible.tsx`): reactive nodes
 * (owners and computations, the dev `onOwner` hook) one more copy of a shape adds, compared part by
 * part with the floor counterpart of the same shape. Both sides are components, so the dev runtime's
 * per-component nodes cancel out (core audit, plan 3 leaf 3.1).
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '../../test/floor/collapsible';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

describe('collapsible cost against the hand-written floor', () => {
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

  /** Nodes one more copy of `shape` adds next to one copy. */
  const perCopy = (shape: () => JSX.Element) =>
    nodes(() => (
      <div>
        {shape()}
        {shape()}
      </div>
    )) - nodes(() => <div>{shape()}</div>);

  const part = {
    root: () => <Collapsible.Root />,
    rootTrigger: () => (
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
      </Collapsible.Root>
    ),
    closed: () => (
      <Collapsible.Root>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ),
    open: () => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ),
  };
  const floor = {
    root: () => <FloorCollapsibleRoot />,
    rootTrigger: () => (
      <FloorCollapsibleRoot>
        <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
      </FloorCollapsibleRoot>
    ),
    closed: () => (
      <FloorCollapsibleRoot>
        <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
        <FloorCollapsiblePanel>Content</FloorCollapsiblePanel>
      </FloorCollapsibleRoot>
    ),
    open: () => (
      <FloorCollapsibleRoot defaultOpen>
        <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
        <FloorCollapsiblePanel>Content</FloorCollapsiblePanel>
      </FloorCollapsibleRoot>
    ),
  };

  it('the floor renders the same DOM as Collapsible, closed and open', () => {
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
          if (attr.name === 'id' || attr.name === 'aria-controls') {
            return attr.name;
          }
          return `${attr.name}=${attr.value}`;
        })
        .sort();
      return `<${el.tagName.toLowerCase()} ${attrs.join(' ')}>${[...el.childNodes].map(canonical).join('')}</>`;
    };
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      const out = [...view.container.childNodes].map(canonical).join('');
      view.unmount();
      return out;
    };
    expect(html(floor.closed)).toBe(html(part.closed));
    expect(html(floor.open)).toBe(html(part.open));
  });

  // Absolute dev budgets from the core spec (S1, S2, S5): beyond a plain element, every component
  // carries one dev root; Root adds its context owner and one grouped effect, Trigger one grouped
  // effect, and a closed Panel nothing (no transition machinery, no warning nodes).
  it('Root costs at most 3 nodes: dev root, context owner, one grouped effect', () => {
    const cost = perCopy(part.root) - perCopy(() => <div />);
    expect(cost, `Root ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(3);
  });

  it('Trigger costs at most 2 nodes: dev root, one grouped effect', () => {
    const cost = perCopy(part.rootTrigger) - perCopy(part.root);
    expect(cost, `Trigger ${cost} nodes`).toBeLessThanOrEqual(2);
  });

  it('a closed Panel costs at most 1 node: its dev root', () => {
    const cost = perCopy(part.closed) - perCopy(part.rootTrigger);
    expect(cost, `closed Panel ${cost} nodes`).toBeLessThanOrEqual(1);
  });

  it('Root costs at most the floor root plus 25%', () => {
    const cost = perCopy(part.root);
    const budget = perCopy(floor.root);
    expect(cost, `Root ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  it('Trigger costs at most the floor trigger plus 25%', () => {
    const cost = perCopy(part.rootTrigger) - perCopy(part.root);
    const budget = perCopy(floor.rootTrigger) - perCopy(floor.root);
    expect(cost, `Trigger ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  it('a closed Panel costs at most the floor closed panel plus 25%', () => {
    const cost = perCopy(part.closed) - perCopy(part.rootTrigger);
    const budget = perCopy(floor.closed) - perCopy(floor.rootTrigger);
    expect(cost, `closed Panel ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  it('an open Collapsible costs at most the open floor plus 25%', () => {
    const cost = perCopy(part.open);
    const budget = perCopy(floor.open);
    expect(cost, `open Collapsible ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });
});
