/*
 * Reactive cost per part (plan 7 step 3): the reactive nodes (owners and computations) one part
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
    const result = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    result.unmount();
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

  it('does not exceed the current node counts (ceilings lowered as step 3 lands)', () => {
    const select = (items: string[]) => () => (
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
    const button = perPart(() => <Button>Button</Button>);
    expect(button, `Button ${button}`).toBeLessThanOrEqual(11);
    const checkbox = perPart(() => <Checkbox.Root />);
    expect(checkbox, `Checkbox.Root ${checkbox}`).toBeLessThanOrEqual(47);
    const item = nodes(select(['a', 'b'])) - nodes(select(['a']));
    expect(item, `Select.Item ${item}`).toBeLessThanOrEqual(27);
  });

  // Plan 7 budgets. Button, Checkbox.Root and Select.Item already pass plain sources (3.4) and
  // omit their own props (3.6); what remains is per element (owners, children and ref machinery,
  // attribute root, state attribute memos) and per part (hooks), for 3.9. `it.fails` flips when a
  // budget is met.
  // Met by the Solid-native Button (plan 8): the parent's insert plus the dev component root.
  it('Button costs at most 3 reactive nodes', () => {
    const cost = perPart(() => <Button>Button</Button>);
    expect(cost, `Button: ${cost} nodes`).toBeLessThanOrEqual(3);
  });

  it.fails('Checkbox.Root costs at most 6 reactive nodes', () => {
    const cost = perPart(() => <Checkbox.Root />);
    expect(cost, `Checkbox.Root: ${cost} nodes`).toBeLessThanOrEqual(6);
  });

  it.fails('Select.Item costs at most 6 reactive nodes', () => {
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
    expect(cost, `Select.Item: ${cost} nodes`).toBeLessThanOrEqual(6);
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
