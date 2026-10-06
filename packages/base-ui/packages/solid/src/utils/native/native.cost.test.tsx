/*
 * Cost budget for native parts (plan 8 step 1.3): the reactive nodes (owners and computations) a
 * native part creates beyond a plain element rendered the same way, counted with Solid's dev
 * `onOwner` hook. The dev runtime wraps every component in one root (`observedComponent`, not in
 * production), so a part's floor beyond a plain element is 1. A native Button with literal props
 * costs nothing beyond that; reactive inputs share one attribute effect; reactive children one
 * insert; static attributes and handlers cost no node.
 */
import { DEV, createSignal, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Button } from '@solidports/base-ui/button';
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

describe('native part cost', () => {
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

  /** Nodes a part costs beyond a plain element in the same position. */
  function beyondPlain(part: () => JSX.Element) {
    return perPart(part) - perPart(() => <button type="button">Button</button>);
  }

  it('a native Button with literal props costs only the dev component root beyond its element', () => {
    const cost = beyondPlain(() => <Button>Button</Button>);
    expect(cost, `Button: ${cost} nodes beyond a plain <button>`).toBeLessThanOrEqual(1);
  });

  it('a native Button costs at most 2 reactive nodes with reactive children and props', () => {
    const [label] = createSignal('Button');
    const [disabled] = createSignal(false);
    const cost = beyondPlain(() => <Button disabled={disabled()}>{label()}</Button>);
    // The dev component root, one attribute effect, one children insert.
    expect(cost, `Button: ${cost} nodes beyond a plain <button>`).toBeLessThanOrEqual(3);
  });

  it('static attributes and handlers create no reactive nodes', () => {
    const plain = nodes(() => <Button>Button</Button>);
    const withStatic = nodes(() => (
      <Button
        data-a="1"
        data-b="2"
        data-c="3"
        aria-label="label"
        title="title"
        onClick={() => {}}
        onKeyDown={() => {}}
        onMouseMove={() => {}}
      >
        Button
      </Button>
    ));
    expect(withStatic - plain).toBe(0);
  });

  it('every reactive input shares one attribute effect', () => {
    const [disabled] = createSignal(false);
    const [title] = createSignal('t');
    const one = nodes(() => <Button disabled={disabled()}>Button</Button>);
    const many = nodes(() => (
      <Button
        disabled={disabled()}
        focusableWhenDisabled={disabled()}
        title={title()}
        aria-label={title()}
        class={(state) => (state.disabled ? 'off' : 'on')}
        style={() => ({ opacity: disabled() ? '0.5' : '1' })}
      >
        Button
      </Button>
    ));
    expect(many - one).toBe(0);
  });
});
