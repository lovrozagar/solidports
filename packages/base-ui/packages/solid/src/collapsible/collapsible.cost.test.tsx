/*
 * Collapsible against its hand-written Solid floor (`test/floor/collapsible.tsx`): reactive nodes
 * (owners and computations, the dev `onOwner` hook) one more copy of a shape adds, compared part by
 * part with the floor counterpart of the same shape. Both sides are components, so the dev runtime's
 * per-component nodes cancel out (core audit, plan 3 leaf 3.1).
 */
import { DEV, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import {
  FloorCollapsiblePanel,
  FloorCollapsibleRoot,
  FloorCollapsibleTrigger,
} from '../../test/floor/collapsible';
import { startingTimeline, withoutSizes } from '../../test/floor/startingTimeline';
import { panelReads } from '../../test/floor/panelReads';

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
  // effect, and a closed Panel only its conditional insert (no transition or warning nodes).
  it('Root costs at most 3 nodes: dev root, context owner, one grouped effect', () => {
    const cost = perCopy(part.root) - perCopy(() => <div />);
    expect(cost, `Root ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(3);
  });

  // A Root with any child gains its children insert, so the Trigger is measured together with its
  // Root: two dev roots, the context owner, two grouped effects and that insert.
  it('Root with a Trigger costs at most 6 nodes: two dev roots, context owner, two grouped effects, the children insert', () => {
    const cost = perCopy(part.rootTrigger) - perCopy(() => <div />);
    expect(cost, `Root + Trigger ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(6);
  });

  // A panel that renders conditionally returns an accessor, and the parent's insert wraps it in one
  // computation: the optimal floor's closed panel costs exactly these 2 nodes too.
  it('a closed Panel costs at most 2 nodes: its dev root and the conditional insert', () => {
    const cost = perCopy(part.closed) - perCopy(part.rootTrigger);
    expect(cost, `closed Panel ${cost} nodes`).toBeLessThanOrEqual(2);
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

  // Two budgets per shape (D19): the floor builds its status at mount, as hand-written code would,
  // while the parts build their machinery on the first open (S5). Laziness moves cost from mount to
  // the first open, so the closed mount and the mount plus the first open are each held to the
  // floor's plus 25%. `open all` pays the first open once per panel: 300 of them in one step.
  function mountAndOpen(make: (open: () => boolean) => JSX.Element) {
    const [open, setOpen] = createSignal(false);
    count = 0;
    hooks.onOwner = counting;
    const view = render(() => make(open));
    flush();
    const mount = count;
    count = 0;
    setOpen(true);
    flush();
    hooks.onOwner = undefined;
    const opened = count;
    view.unmount();
    return { mount, open: opened };
  }

  const controlled = {
    part: (open: () => boolean) => (
      <Collapsible.Root open={open()}>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel>Content</Collapsible.Panel>
      </Collapsible.Root>
    ),
    floor: (open: () => boolean) => (
      <FloorCollapsibleRoot open={open()}>
        <FloorCollapsibleTrigger>Toggle</FloorCollapsibleTrigger>
        <FloorCollapsiblePanel>Content</FloorCollapsiblePanel>
      </FloorCollapsibleRoot>
    ),
  };

  it('a closed Collapsible mounts at most the floor plus 25%', () => {
    const cost = mountAndOpen(controlled.part).mount;
    const budget = mountAndOpen(controlled.floor).mount;
    expect(cost, `closed mount ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  it("a Collapsible's mount plus its first open costs at most the floor's plus 25%", () => {
    const part = mountAndOpen(controlled.part);
    const floor = mountAndOpen(controlled.floor);
    const cost = part.mount + part.open;
    const budget = floor.mount + floor.open;
    expect(
      cost,
      `mount ${part.mount} + first open ${part.open} nodes, floor ${floor.mount} + ${floor.open}`,
    ).toBeLessThanOrEqual(Math.floor(budget * 1.25));
  });

  // The floor models every branch the parts support (D19), so its starting-style timeline matches
  // theirs with and without motion. The expected samples are the ones Chromium shows for React's
  // Collapsible.
  async function timeline(make: (open: () => boolean) => JSX.Element, motion: boolean) {
    const [open, setOpen] = createSignal(false);
    const view = render(() => make(open));
    flush();
    const samples = await startingTimeline(view.container, () => setOpen(true), motion);
    view.unmount();
    return samples;
  }

  it("the floor's starting-style timeline matches Collapsible's without motion", async () => {
    const part = await timeline(controlled.part, false);
    expect(part).toEqual({
      beforePaint: 'div button | --collapsible-panel-height:auto;--collapsible-panel-width:auto',
      afterFrame: 'div button | --collapsible-panel-height:auto;--collapsible-panel-width:auto',
      afterTask: ' | --collapsible-panel-height:auto;--collapsible-panel-width:auto',
    });
    expect(await timeline(controlled.floor, false)).toEqual(part);
  });

  it("the floor's starting-style timeline matches Collapsible's with motion", async () => {
    const part = await timeline(controlled.part, true);
    expect(withoutSizes(part)).toEqual({
      beforePaint:
        'div button div | --collapsible-panel-height:Npx;--collapsible-panel-width:Npx;align-content:initial;align-items:initial;justify-content:initial;justify-items:initial',
      afterFrame: 'div button div | --collapsible-panel-height:Npx;--collapsible-panel-width:Npx',
      afterTask: ' | --collapsible-panel-height:auto;--collapsible-panel-width:auto',
    });
    expect(await timeline(controlled.floor, true)).toEqual(part);
  });

  // An open's layout reads on its panel (D19): the floor's 1/0/0 without motion and 1/1/1 with it
  // (React reads 2/1/1 on both). The part may match the floor's count, not exceed it.
  for (const motion of [false, true]) {
    it(`a panel's open reads its layout at most as often as the floor's, ${motion ? 'with' : 'without'} motion`, async () => {
      const reads = async (make: (open: () => boolean) => JSX.Element) => {
        const [open, setOpen] = createSignal(false);
        const view = render(() => make(open));
        flush();
        const counted = await panelReads(view.container, () => setOpen(true), motion);
        view.unmount();
        return counted;
      };
      const floor = await reads(controlled.floor);
      expect(floor).toEqual(
        motion
          ? { getComputedStyle: 1, scrollHeight: 1, scrollWidth: 1 }
          : { getComputedStyle: 1, scrollHeight: 0, scrollWidth: 0 },
      );
      const part = await reads(controlled.part);
      for (const key of ['getComputedStyle', 'scrollHeight', 'scrollWidth'] as const) {
        expect(part[key], `${key}: part ${part[key]}, floor ${floor[key]}`).toBeLessThanOrEqual(
          floor[key],
        );
      }
    });
  }

  it('an open Collapsible costs at most the open floor plus 25%', () => {
    const cost = perCopy(part.open);
    const budget = perCopy(floor.open);
    expect(cost, `open Collapsible ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  // The `render` values the port takes (`validateRenderProp`): a tag, a `{ component }` config
  // naming a tag or a consumer component, and a render function. Each renders natively at the plain
  // part's cost; a component or a function adds only its own nodes beyond a plain tag (plan 3 leaf
  // 5.1.2).
  const triggerFn = (props: object) => <button {...props} />;
  const panelFn = (props: object) => <section {...props} />;
  /** A consumer component in `render`: forwards every prop, the ref included, to a tag. */
  const AppButton = (props: JSX.HTMLAttributes<HTMLButtonElement>) => <button {...props} />;
  const AppSection = (props: JSX.HTMLAttributes<HTMLElement>) => <section {...props} />;
  const forms = [
    { name: 'a tag', trigger: 'button', panel: 'section', own: () => 0 },
    {
      name: 'a component config',
      trigger: { component: 'button' },
      panel: { component: 'section' },
      own: () => 0,
    },
    {
      name: 'a consumer component',
      trigger: { component: AppButton },
      panel: { component: AppSection },
      own: (tag: 'trigger' | 'panel') =>
        tag === 'trigger'
          ? perCopy(() => <AppButton />) - perCopy(() => <button />)
          : perCopy(() => <AppSection />) - perCopy(() => <section />),
    },
    {
      name: 'a render function',
      trigger: triggerFn,
      panel: panelFn,
      // Beyond its own element, a render function runs in its own memo, so its top-level reads
      // re-render it and nothing else does: a parent resolves all its children in one computation.
      // Measured without the memo (2026-10-17, the function called from the resolving computation):
      // beside a sibling Trigger whose function read a signal at its top level, a function with
      // only an inner read ran 2 times to the slow path's 1 when that signal changed, and a Panel
      // beside it ran 2 times with a new element; while hydrating, the Panel's element went
      // unclaimed. A part that returns the memo as an accessor gets one more computation from the
      // parent's insert, as any function child does; a panel's own conditional already resolves it.
      own: (tag: 'trigger' | 'panel') =>
        tag === 'trigger'
          ? perCopy(() => triggerFn({})) - perCopy(() => <button />) + 2
          : perCopy(() => panelFn({})) - perCopy(() => <section />) + 1,
    },
  ] as const;
  const openRootTrigger = () => (
    <Collapsible.Root defaultOpen>
      <Collapsible.Trigger>Toggle</Collapsible.Trigger>
    </Collapsible.Root>
  );

  // A tag or a config naming one renders the part's own element: the part returns that element,
  // not an accessor, so its parent's insert has nothing more to resolve.
  it('a Trigger with a tag or a tag config costs exactly the plain Trigger', () => {
    const plain = perCopy(part.rootTrigger);
    const tag = 'button';
    const config = { component: 'button' };
    const asTag = perCopy(() => (
      <Collapsible.Root>
        <Collapsible.Trigger render={tag}>Toggle</Collapsible.Trigger>
      </Collapsible.Root>
    ));
    const asConfig = perCopy(() => (
      <Collapsible.Root>
        <Collapsible.Trigger render={config}>Toggle</Collapsible.Trigger>
      </Collapsible.Root>
    ));
    expect([asTag, asConfig], `plain ${plain}`).toEqual([plain, plain]);
  });

  for (const form of forms) {
    // Plain identifiers, which the compiler passes as static props: `render={triggerRender}` would
    // compile to a getter, a reactive `render`, which keeps the slow path.
    const { trigger: triggerRender, panel: panelRender } = form;
    describe(`with ${form.name} as render`, () => {
      it('a Trigger costs at most the plain Trigger plus its own element', () => {
        const cost =
          perCopy(() => (
            <Collapsible.Root>
              <Collapsible.Trigger render={triggerRender}>Toggle</Collapsible.Trigger>
            </Collapsible.Root>
          )) - perCopy(part.root);
        const budget = perCopy(part.rootTrigger) - perCopy(part.root) + form.own('trigger');
        expect(cost, `Trigger ${cost} nodes, native ${budget}`).toBeLessThanOrEqual(budget);
      });

      it('a closed Panel costs at most the plain closed Panel', () => {
        const cost =
          perCopy(() => (
            <Collapsible.Root>
              <Collapsible.Trigger>Toggle</Collapsible.Trigger>
              <Collapsible.Panel render={panelRender}>Content</Collapsible.Panel>
            </Collapsible.Root>
          )) - perCopy(part.rootTrigger);
        const budget = perCopy(part.closed) - perCopy(part.rootTrigger);
        expect(cost, `closed Panel ${cost} nodes, native ${budget}`).toBeLessThanOrEqual(budget);
      });

      it('an open Panel costs at most the plain open Panel plus its own element', () => {
        const cost =
          perCopy(() => (
            <Collapsible.Root defaultOpen>
              <Collapsible.Trigger>Toggle</Collapsible.Trigger>
              <Collapsible.Panel render={panelRender}>Content</Collapsible.Panel>
            </Collapsible.Root>
          )) - perCopy(openRootTrigger);
        const budget = perCopy(part.open) - perCopy(openRootTrigger) + form.own('panel');
        expect(cost, `open Panel ${cost} nodes, native ${budget}`).toBeLessThanOrEqual(budget);
      });
    });
  }
});
