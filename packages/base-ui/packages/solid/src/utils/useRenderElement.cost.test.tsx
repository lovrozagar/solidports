/* eslint-disable solid/prefer-for -- counts each part's own reactive nodes; <For> would add its own */
/*
 * Reactive cost per part: the reactive nodes (owners and computations) one part
 * creates, counted with Solid's dev `onOwner` hook. Budgets are the render-core v3 targets.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@solidports/base-ui/button';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Select } from '@solidports/base-ui/select';
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

  it('Checkbox.Root costs at most 10 reactive nodes', () => {
    const cost = perPart(() => <Checkbox.Root />);
    expect(cost, `Checkbox.Root: ${cost} nodes`).toBeLessThanOrEqual(10);
  });

  it('Select.Item costs at most 26 reactive nodes', () => {
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
    const cost = nodes(list(['a', 'b'])) - nodes(list(['a']));
    expect(cost, `Select.Item: ${cost} nodes`).toBeLessThanOrEqual(26);
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
