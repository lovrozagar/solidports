/*
 * Accordion against its hand-written Solid floor (`test/floor/accordion.tsx`): reactive nodes (owners
 * and computations, the dev `onOwner` hook) one more copy of a shape adds, compared part by part
 * with the floor counterpart of the same shape. Both sides are components, so the dev runtime's
 * per-component nodes cancel out (plan 3, Accordion after the Collapsible pilot).
 */
import { DEV, createSignal, flush } from 'solid-js';
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
import { startingTimeline } from '../../test/floor/startingTimeline';

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
        perItem(partRoot(false), part[shape]) - (below ? perItem(partRoot(false), part[below]) : 0);
      const budget =
        perItem(floorRoot(false), floor[shape]) -
        (below ? perItem(floorRoot(false), floor[below]) : 0);
      expect(cost, `${name} ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
        Math.floor(budget * 1.25),
      );
    });
  }

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
      <Accordion.Root value={open() ? ['a'] : []}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel>Content</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ),
    floor: (open: () => boolean) => (
      <FloorAccordionRoot value={open() ? ['a'] : []}>
        <FloorAccordionItem value="a">
          <FloorAccordionHeader>
            <FloorAccordionTrigger>Toggle</FloorAccordionTrigger>
          </FloorAccordionHeader>
          <FloorAccordionPanel>Content</FloorAccordionPanel>
        </FloorAccordionItem>
      </FloorAccordionRoot>
    ),
  };

  it('an accordion with a closed item mounts at most the floor plus 25%', () => {
    const cost = mountAndOpen(controlled.part).mount;
    const budget = mountAndOpen(controlled.floor).mount;
    expect(cost, `closed mount ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  it("an accordion's mount plus an item's first open costs at most the floor's plus 25%", () => {
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
  // Accordion.
  async function timeline(make: (open: () => boolean) => JSX.Element, motion: boolean) {
    const [open, setOpen] = createSignal(false);
    const view = render(() => make(open));
    flush();
    const samples = await startingTimeline(view.container, () => setOpen(true), motion);
    view.unmount();
    return samples;
  }

  it("the floor's starting-style timeline matches Accordion's without motion", async () => {
    const part = await timeline(controlled.part, false);
    expect(part).toEqual({
      beforePaint: ' | --accordion-panel-height:auto;--accordion-panel-width:auto',
      afterFrame: ' | --accordion-panel-height:auto;--accordion-panel-width:auto',
      afterTask: ' | --accordion-panel-height:auto;--accordion-panel-width:auto',
    });
    expect(await timeline(controlled.floor, false)).toEqual(part);
  });

  it("the floor's starting-style timeline matches Accordion's with motion", async () => {
    const part = await timeline(controlled.part, true);
    expect(part).toEqual({
      beforePaint:
        'div | --accordion-panel-height:0px;--accordion-panel-width:0px;align-content:initial;align-items:initial;justify-content:initial;justify-items:initial',
      afterFrame: 'div | --accordion-panel-height:0px;--accordion-panel-width:0px',
      afterTask: ' | --accordion-panel-height:auto;--accordion-panel-width:auto',
    });
    expect(await timeline(controlled.floor, true)).toEqual(part);
  });

  it('an open item costs at most the open floor item plus 25%', () => {
    const cost = perItem(partRoot(true), part.full);
    const budget = perItem(floorRoot(true), floor.full);
    expect(cost, `open item ${cost} nodes, floor ${budget}`).toBeLessThanOrEqual(
      Math.floor(budget * 1.25),
    );
  });

  // The `render` values the port takes (`validateRenderProp`): a tag, a `{ component }` config
  // naming a tag or a consumer component, and a render function. Each renders natively at the plain
  // part's cost; a component or a function adds only its own nodes beyond a plain tag (plan 3 leaf
  // 5.1.2).
  const perCopy = (shape: () => JSX.Element) =>
    nodes(() => (
      <div>
        {shape()}
        {shape()}
      </div>
    )) - nodes(() => <div>{shape()}</div>);
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

  // A tag or a config naming one renders the part's own element: the part returns that element,
  // not an accessor, so its parent's insert has nothing more to resolve.
  it('a Trigger with a tag or a tag config costs exactly the plain Trigger', () => {
    const plain = perItem(partRoot(false), part.trigger);
    const tag = 'button';
    const config = { component: 'button' };
    const shape = (render: Accordion.Trigger.Props['render']) => () => (
      <Accordion.Item value="a">
        <Accordion.Header>
          <Accordion.Trigger render={render}>Toggle</Accordion.Trigger>
        </Accordion.Header>
      </Accordion.Item>
    );
    const asTag = perItem(partRoot(false), shape(tag));
    const asConfig = perItem(partRoot(false), shape(config));
    expect([asTag, asConfig], `plain ${plain}`).toEqual([plain, plain]);
  });

  for (const form of forms) {
    // Plain identifiers, which the compiler passes as static props: `render={triggerRender}` would
    // compile to a getter, a reactive `render`, which keeps the slow path.
    const { trigger: triggerRender, panel: panelRender } = form;
    describe(`with ${form.name} as render`, () => {
      it('a Trigger costs at most the plain Trigger plus its own element', () => {
        const cost =
          perItem(partRoot(false), () => (
            <Accordion.Item value="a">
              <Accordion.Header>
                <Accordion.Trigger render={triggerRender}>Toggle</Accordion.Trigger>
              </Accordion.Header>
            </Accordion.Item>
          )) - perItem(partRoot(false), part.header);
        const budget =
          perItem(partRoot(false), part.trigger) -
          perItem(partRoot(false), part.header) +
          form.own('trigger');
        expect(cost, `Trigger ${cost} nodes, native ${budget}`).toBeLessThanOrEqual(budget);
      });

      for (const open of [false, true]) {
        const state = open ? 'open' : 'closed';
        it(`${open ? 'an' : 'a'} ${state} Panel costs at most the plain ${state} Panel${open ? ' plus its own element' : ''}`, () => {
          const cost =
            perItem(partRoot(open), () => (
              <Accordion.Item value="a">
                <Accordion.Header>
                  <Accordion.Trigger>Toggle</Accordion.Trigger>
                </Accordion.Header>
                <Accordion.Panel render={panelRender}>Content</Accordion.Panel>
              </Accordion.Item>
            )) - perItem(partRoot(open), part.trigger);
          const budget =
            perItem(partRoot(open), part.full) -
            perItem(partRoot(open), part.trigger) +
            (open ? form.own('panel') : 0);
          expect(cost, `${state} Panel ${cost} nodes, native ${budget}`).toBeLessThanOrEqual(
            budget,
          );
        });
      }
    });
  }
});
