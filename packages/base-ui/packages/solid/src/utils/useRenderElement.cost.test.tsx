/* eslint-disable solid/prefer-for -- counts each part's own reactive nodes; <For> would add its own */
/*
 * Reactive cost per part: the reactive nodes (owners and computations) one part
 * creates, counted with Solid's dev `onOwner` hook. Budgets are the render-core v3 targets.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Avatar } from '@solidports/base-ui/avatar';
import { Button } from '@solidports/base-ui/button';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Combobox } from '@solidports/base-ui/combobox';
import { Select } from '@solidports/base-ui/select';
import { useRender } from '@solidports/base-ui/use-render';
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

describe('render core cost', () => {
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

  /** Nodes one extra copy of `part` adds next to `n` copies. */
  function perPart(part: () => JSX.Element) {
    const one = nodes(() => <div>{part()}</div>);
    const two = nodes(() => (
      <div>
        {part()}
        {part()}
      </div>
    ));
    return two - one;
  }

  // Per-part ceilings at the measured counts: a change that adds a node fails here. Checkbox.Root's
  // nodes are the parent's insert, its context provider (owner, lazy children and keep-alive), the
  // root's and the input's attribute effects, and `useControlled`'s dev-only warning effect.
  // Met by the Solid-native Button: the parent's insert plus the dev component root.
  it('Button costs at most 3 reactive nodes', () => {
    const cost = perPart(() => <Button>Button</Button>);
    expect(cost, `Button: ${cost} nodes`).toBeLessThanOrEqual(3);
  });

  it('Checkbox.Root costs at most 7 reactive nodes', () => {
    const cost = perPart(() => <Checkbox.Root />);
    expect(cost, `Checkbox.Root: ${cost} nodes`).toBeLessThanOrEqual(7);
  });

  it('Select.Item costs at most 23 reactive nodes', () => {
    const list = (items: string[]) => () => (
      <Select.Root defaultOpen>
        <Select.Trigger>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              {items.map((item) => (
                <Select.Item value={item}>{item}</Select.Item>
              ))}
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    );
    // The third item: the second creates the list's id selector (`createIdSelector`, its root
    // and projection), once per list, as readers first ask about a second id.
    const cost = nodes(list(['a', 'b', 'c'])) - nodes(list(['a', 'b']));
    expect(cost, `Select.Item: ${cost} nodes`).toBeLessThanOrEqual(23);
    const second = nodes(list(['a', 'b'])) - nodes(list(['a']));
    expect(second - cost, `Select's id selector: ${second - cost} nodes`).toBeLessThanOrEqual(2);
  });

  it('Combobox.Item costs at most 23 reactive nodes', () => {
    const list = (items: string[]) => () => (
      <Combobox.Root items={items} defaultOpen>
        <Combobox.Input />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                {(item: string) => <Combobox.Item value={item}>{item}</Combobox.Item>}
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    );
    // The third item: the second creates the list's id selector (`createIdSelector`, its root
    // and projection), once per list, as readers first ask about a second id.
    const cost = nodes(list(['a', 'b', 'c'])) - nodes(list(['a', 'b']));
    expect(cost, `Combobox.Item: ${cost} nodes`).toBeLessThanOrEqual(23);
    const second = nodes(list(['a', 'b'])) - nodes(list(['a']));
    expect(second - cost, `Combobox's id selector: ${second - cost} nodes`).toBeLessThanOrEqual(2);
  });

  // The slowest static mounts (plan 3 leaf 1.13): an Avatar with its image and fallback, and a
  // minimal part built on \`useRender\`, both on the slow path.
  it('an Avatar (Root, Image, Fallback) costs at most 49 reactive nodes', () => {
    const cost = perPart(() => (
      <Avatar.Root>
        <Avatar.Image src="data:," width="8" height="8" />
        <Avatar.Fallback>A</Avatar.Fallback>
      </Avatar.Root>
    ));
    expect(cost, `Avatar: ${cost} nodes`).toBeLessThanOrEqual(49);
  });

  it('a part built on useRender costs at most 16 reactive nodes', () => {
    function Part(props: useRender.ComponentProps<'button'>) {
      const view = useRender({
        defaultTagName: 'button',
        get render() {
          return props.render;
        },
        props: { type: 'button', children: 'part' },
      });
      return view();
    }
    const cost = perPart(() => <Part />);
    expect(cost, `useRender part: ${cost} nodes`).toBeLessThanOrEqual(16);
  });

  it('static attributes create no reactive nodes', () => {
    const plain = nodes(() => <Button>Button</Button>);
    const withStatic = nodes(() => (
      <Button data-a="1" data-b="2" data-c="3" aria-label="label" title="title">
        Button
      </Button>
    ));
    expect(withStatic - plain).toBe(0);
  });
});
