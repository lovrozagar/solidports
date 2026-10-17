/*
 * Cost budgets for the toggles batch: reactive nodes (owners and computations)
 * a native part creates beyond a plain element written by hand with the same DOM, counted with
 * Solid's dev `onOwner` hook (`native.cost.test.tsx` explains the dev component root floor of 1).
 * Each budget names what the nodes are spent on.
 */
import { DEV, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { Switch } from '@solidports/base-ui/switch';
import { Toggle } from '@solidports/base-ui/toggle';
import { ToggleGroup } from '@solidports/base-ui/toggle-group';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { createRenderer, expectNoSlowPath } from '#test-utils';
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

describe('native toggles cost', () => {
  const { render } = createRenderer();

  function nodes(ui: () => JSX.Element) {
    count = 0;
    hooks.onOwner = counting;
    const view = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    // The budgets are the native path's: a part that fell back to the slow path fails here.
    expectNoSlowPath(view.container);
    view.unmount();
    return created;
  }

  /** Nodes one extra copy of `part` adds next to `n` copies (includes the parent's insert). */
  function perPart(
    part: () => JSX.Element,
    wrap: (children: JSX.Element) => JSX.Element = (c) => <div>{c}</div>,
  ) {
    const one = nodes(() => wrap(part()));
    const two = nodes(() =>
      wrap(
        <>
          {part()}
          {part()}
        </>,
      ),
    );
    return two - one;
  }

  /** A checkbox written by hand: one signal, one attribute effect per element. */
  function RawCheckbox() {
    const [checked, setChecked] = createSignal(false);
    return (
      <>
        <span
          role="checkbox"
          tabindex="0"
          aria-checked={checked() ? 'true' : 'false'}
          data-checked={checked() ? '' : undefined}
          onClick={() => setChecked((value) => !value)}
        >
          <span data-checked={checked() ? '' : undefined}>✓</span>
        </span>
        <input type="checkbox" tabindex="-1" aria-hidden="true" checked={checked()} />
      </>
    );
  }

  it('Checkbox.Root + Indicator: ≤ 10 nodes beyond a hand-written checkbox', () => {
    const raw = perPart(() => <RawCheckbox />);
    const part = perPart(() => (
      <Checkbox.Root>
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Root>
    ));
    // Measured 2026-10-17 (dev runtime): dev component roots (root, indicator, context provider),
    // the provider owner, the controlled state (signal + dev-only warning effect), the root's
    // attribute effect, the hidden input's effect, the label-fallback effect, the children
    // insert, and the indicator's Show. Its transition machinery is created when it is first
    // checked (4.8a).
    expect(
      part - raw,
      `Checkbox: ${part - raw} nodes beyond raw (${part} vs ${raw})`,
    ).toBeLessThanOrEqual(10);
  });

  it('an unchecked Checkbox.Indicator: ≤ 7 nodes beyond its root, its transition machinery not yet made', () => {
    // Plan 3, 4.8a: the indicator built its transition status (two writable memos) and its
    // open-change-complete effect while unchecked, when it renders nothing (10 nodes). Left: the
    // dev component roots (2), the `<Show>` (its condition, memo and value) and two inserts.
    const root = perPart(() => <Checkbox.Root />);
    const part = perPart(() => (
      <Checkbox.Root>
        <Checkbox.Indicator />
      </Checkbox.Root>
    ));
    expect(part - root, `indicator: ${part - root} nodes (${part} vs ${root})`).toBeLessThanOrEqual(
      7,
    );
  });

  it('an unchecked Radio.Indicator: ≤ 7 nodes beyond its root, its transition machinery not yet made', () => {
    const root = perPart(
      () => <Radio.Root value="b" />,
      (children) => <RadioGroup defaultValue="a">{children}</RadioGroup>,
    );
    const part = perPart(
      () => (
        <Radio.Root value="b">
          <Radio.Indicator />
        </Radio.Root>
      ),
      (children) => <RadioGroup defaultValue="a">{children}</RadioGroup>,
    );
    expect(part - root, `indicator: ${part - root} nodes (${part} vs ${root})`).toBeLessThanOrEqual(
      7,
    );
  });

  it('Switch.Root + Thumb: ≤ 6 nodes beyond a hand-written switch', () => {
    const raw = perPart(() => <RawCheckbox />);
    const part = perPart(() => (
      <Switch.Root>
        <Switch.Thumb />
      </Switch.Root>
    ));
    expect(
      part - raw,
      `Switch: ${part - raw} nodes beyond raw (${part} vs ${raw})`,
    ).toBeLessThanOrEqual(6);
  });

  it('Toggle: ≤ 5 nodes beyond a hand-written toggle button', () => {
    const raw = perPart(() => {
      const [pressed, setPressed] = createSignal(false);
      return (
        <button
          type="button"
          aria-pressed={pressed() ? 'true' : 'false'}
          onClick={() => setPressed((v) => !v)}
        >
          T
        </button>
      );
    });
    const part = perPart(() => <Toggle>T</Toggle>);
    expect(
      part - raw,
      `Toggle: ${part - raw} nodes beyond raw (${part} vs ${raw})`,
    ).toBeLessThanOrEqual(5);
  });

  it('Toggle in a ToggleGroup: ≤ 5 nodes beyond a hand-written grouped toggle', () => {
    const [value, setValue] = createSignal<string[]>([]);
    const raw = perPart(
      () => (
        <button
          type="button"
          tabindex={value().length ? -1 : 0}
          aria-pressed={value().includes('a') ? 'true' : 'false'}
          onClick={() => setValue(['a'])}
        >
          T
        </button>
      ),
      (children) => <div role="group">{children}</div>,
    );
    const part = perPart(
      () => <Toggle value="a">T</Toggle>,
      (children) => <ToggleGroup>{children}</ToggleGroup>,
    );
    // The controlled memo (group membership), the list index signal, the dev root.
    expect(
      part - raw,
      `Toggle in group: ${part - raw} nodes beyond raw (${part} vs ${raw})`,
    ).toBeLessThanOrEqual(5);
  });

  it('Radio.Root + Indicator in a RadioGroup: ≤ 10 nodes beyond a hand-written radio', () => {
    const [value, setValue] = createSignal('a');
    const raw = perPart(
      () => (
        <>
          <span
            role="radio"
            tabindex={value() === 'a' ? 0 : -1}
            aria-checked={value() === 'a' ? 'true' : 'false'}
            onClick={() => setValue('a')}
          >
            <span data-checked={value() === 'a' ? '' : undefined} />
          </span>
          <input type="radio" tabindex="-1" aria-hidden="true" checked={value() === 'a'} />
        </>
      ),
      (children) => <div role="radiogroup">{children}</div>,
    );
    const part = perPart(
      () => (
        <Radio.Root value="a">
          <Radio.Indicator />
        </Radio.Root>
      ),
      (children) => <RadioGroup>{children}</RadioGroup>,
    );
    expect(
      part - raw,
      `Radio: ${part - raw} nodes beyond raw (${part} vs ${raw})`,
    ).toBeLessThanOrEqual(10);
  });
});
