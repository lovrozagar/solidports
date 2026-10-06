/*
 * Cost budgets for the toggles batch (plan 8 step 3.1): reactive nodes (owners and computations)
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

describe('native toggles cost', () => {
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

  /** Nodes one extra copy of `part` adds next to `n` copies (includes the parent's insert). */
  function perPart(part: () => JSX.Element, wrap: (children: JSX.Element) => JSX.Element = (c) => <div>{c}</div>) {
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

  it('Checkbox.Root + Indicator: ≤ 19 nodes beyond a hand-written checkbox', () => {
    const raw = perPart(() => <RawCheckbox />);
    const part = perPart(() => (
      <Checkbox.Root>
        <Checkbox.Indicator>✓</Checkbox.Indicator>
      </Checkbox.Root>
    ));
    // Measured 2026-10-06 (dev runtime): dev component roots (root, indicator, context provider),
    // the provider owner, the controlled state (signal + dev-only warning effect), the root's
    // attribute effect, the hidden input's effect, the label-fallback effect, the children
    // insert, and the indicator's Show, transition status (2 writable memos + effect) and
    // open-change-complete effect. Tighten as the machinery gets lazier.
    expect(part - raw, `Checkbox: ${part - raw} nodes beyond raw (${part} vs ${raw})`).toBeLessThanOrEqual(19);
  });

  it('Switch.Root + Thumb: ≤ 10 nodes beyond a hand-written switch', () => {
    const raw = perPart(() => <RawCheckbox />);
    const part = perPart(() => (
      <Switch.Root>
        <Switch.Thumb />
      </Switch.Root>
    ));
    expect(part - raw, `Switch: ${part - raw} nodes beyond raw (${part} vs ${raw})`).toBeLessThanOrEqual(10);
  });

  it('Toggle: ≤ 5 nodes beyond a hand-written toggle button', () => {
    const raw = perPart(() => {
      const [pressed, setPressed] = createSignal(false);
      return (
        <button type="button" aria-pressed={pressed() ? 'true' : 'false'} onClick={() => setPressed((v) => !v)}>
          T
        </button>
      );
    });
    const part = perPart(() => <Toggle>T</Toggle>);
    expect(part - raw, `Toggle: ${part - raw} nodes beyond raw (${part} vs ${raw})`).toBeLessThanOrEqual(5);
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
    expect(part - raw, `Toggle in group: ${part - raw} nodes beyond raw (${part} vs ${raw})`).toBeLessThanOrEqual(5);
  });

  it('Radio.Root + Indicator in a RadioGroup: ≤ 18 nodes beyond a hand-written radio', () => {
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
    expect(part - raw, `Radio: ${part - raw} nodes beyond raw (${part} vs ${raw})`).toBeLessThanOrEqual(18);
  });
});
