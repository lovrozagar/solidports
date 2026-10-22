/* eslint-disable testing-library/no-container -- reads the parts by test id within the render */
/*
 * A one-time-code field against the hand-written floor (`test/floor/otpField.tsx`, D32's sweep):
 * Root and Input render on the native path with the floor's DOM, and the dev runtime's reactive
 * nodes each part adds stay at its native budget. The parts render natively on the client only:
 * the server prints each slot's character as its `value`, which the slow path renders.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { OTPField } from '@solidports/base-ui/otp-field';
import { createRenderer, isJSDOM } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import { FloorOTPFieldInput, FloorOTPFieldRoot } from '../../test/floor/otpField';

type Hooks = { onOwner?: (owner: unknown) => void };
const hooks = (DEV as unknown as { hooks: Hooks }).hooks;

let count = 0;
const counting = (owner: unknown) => {
  count += owner ? 1 : 0;
};

afterEach(() => {
  hooks.onOwner = undefined;
});

/** Each part's count at D32's port; the slow path's in the comment. */
const BUDGET = {
  root: 24, // slow 36, floor 11
  input: 8, // slow 36, floor 4
};

type Part = keyof typeof BUDGET;

describe('OTP field cost against the hand-written floor', () => {
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

  /** Nodes one more copy of `shape` adds next to four. */
  const perCopy = (shape: () => JSX.Element) =>
    nodes(() => Array.from({ length: 5 }, shape)) - nodes(() => Array.from({ length: 4 }, shape));

  /** A field of `slots` slots, each rendered (the root warns on a mismatch). */
  const library = (slots: number) => () => (
    <OTPField.Root length={slots}>
      {Array.from({ length: slots }, () => (
        <OTPField.Input />
      ))}
    </OTPField.Root>
  );
  const floor = (slots: number) => () => (
    <FloorOTPFieldRoot length={slots}>
      {Array.from({ length: slots }, () => (
        <FloorOTPFieldInput />
      ))}
    </FloorOTPFieldRoot>
  );
  const cost = (shape: (slots: number) => () => JSX.Element, part: Part) =>
    part === 'root'
      ? perCopy(shape(1)) - (perCopy(shape(2)) - perCopy(shape(1)))
      : perCopy(shape(6)) - perCopy(shape(5));

  it.skipIf(!isJSDOM)('the floor renders the same DOM as an OTP field', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      // Inline styles compared as their sorted declarations: the compiler writes a static style
      // compactly.
      const tree = normalizeTree(view.container).replace(/style="([^"]*)"/g, (_, style: string) => {
        const declarations = style
          .split(';')
          .map((declaration) => declaration.replace(/\s+/g, ''))
          .filter(Boolean)
          .sort();
        return `style="${declarations.join(';')}"`;
      });
      view.unmount();
      return tree;
    };
    expect(html(floor(6))).toBe(html(library(6)));
  });

  it("an OTP field's parts render on the native path", () => {
    const view = render(() => (
      <OTPField.Root length={2} data-testid="root">
        <OTPField.Input data-testid="input" />
        <OTPField.Input />
      </OTPField.Root>
    ));
    flush();
    const names = Object.keys(BUDGET);
    const paths = Object.fromEntries(
      names.map((name) => [
        name,
        renderPathOf(view.container.querySelector(`[data-testid="${name}"]`)!),
      ]),
    );
    expect(paths).toEqual(Object.fromEntries(names.map((name) => [name, 'native'])));
    view.unmount();
  });

  it.each(Object.keys(BUDGET) as Part[])('%s costs at most its native budget', (part) => {
    const partCost = cost(library, part);
    expect(partCost, `${part} ${partCost} nodes, floor ${cost(floor, part)}`).toBeLessThanOrEqual(
      BUDGET[part],
    );
  });
});
