/* eslint-disable testing-library/no-container -- reads the parts by test id within the render */
/*
 * A number field against the hand-written floor (`test/floor/numberField.tsx`, D32's sweep): Root,
 * ScrubArea, Group, Input, Increment and Decrement render on the native path with the floor's DOM,
 * and the dev runtime's reactive nodes each part adds stay at its native budget. ScrubAreaCursor,
 * which renders only while scrubbing, stays on the slow path.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { NumberField } from '@solidports/base-ui/number-field';
import { createRenderer, isJSDOM } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import {
  FloorNumberFieldDecrement,
  FloorNumberFieldGroup,
  FloorNumberFieldIncrement,
  FloorNumberFieldInput,
  FloorNumberFieldRoot,
  FloorNumberFieldScrubArea,
} from '../../test/floor/numberField';

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
  root: 16, // slow 28, floor 11
  scrubArea: 8, // slow 19, floor 3
  group: 3, // slow 13, floor 3
  input: 5, // slow 28, floor 4
  increment: 4, // slow 27, floor 6
  decrement: 4, // slow 27, floor 6
};

type Part = keyof typeof BUDGET;

describe('number field cost against the hand-written floor', () => {
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

  const library: Record<Part, () => JSX.Element> = {
    root: () => null,
    scrubArea: () => <NumberField.ScrubArea />,
    group: () => <NumberField.Group />,
    input: () => <NumberField.Input />,
    increment: () => <NumberField.Increment />,
    decrement: () => <NumberField.Decrement />,
  };
  const floor: Record<Part, () => JSX.Element> = {
    root: () => null,
    scrubArea: () => <FloorNumberFieldScrubArea />,
    group: () => <FloorNumberFieldGroup />,
    input: () => <FloorNumberFieldInput />,
    increment: () => <FloorNumberFieldIncrement />,
    decrement: () => <FloorNumberFieldDecrement />,
  };
  const libraryCost = (part: Part) => {
    const root = perCopy(() => <NumberField.Root />);
    return part === 'root'
      ? root
      : perCopy(() => <NumberField.Root>{library[part]()}</NumberField.Root>) - root;
  };
  const floorCost = (part: Part) => {
    const root = perCopy(() => <FloorNumberFieldRoot />);
    return part === 'root'
      ? root
      : perCopy(() => <FloorNumberFieldRoot>{floor[part]()}</FloorNumberFieldRoot>) - root;
  };

  // Solid: a browser rewrites inline style declarations (it folds `-webkit-user-select`).
  it.skipIf(!isJSDOM)('the floor renders the same DOM as a number field', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      // Inline styles compared as their sorted declarations: the compiler writes a static style
      // compactly, and the hidden input's declarations follow its style object's order.
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
    expect(
      html(() => (
        <FloorNumberFieldRoot>
          <FloorNumberFieldScrubArea>
            <span>Label</span>
          </FloorNumberFieldScrubArea>
          <FloorNumberFieldGroup>
            <FloorNumberFieldDecrement />
            <FloorNumberFieldInput />
            <FloorNumberFieldIncrement />
          </FloorNumberFieldGroup>
        </FloorNumberFieldRoot>
      )),
    ).toBe(
      html(() => (
        <NumberField.Root>
          <NumberField.ScrubArea>
            <span>Label</span>
          </NumberField.ScrubArea>
          <NumberField.Group>
            <NumberField.Decrement />
            <NumberField.Input />
            <NumberField.Increment />
          </NumberField.Group>
        </NumberField.Root>
      )),
    );
  });

  it("a number field's parts render on the native path", () => {
    const view = render(() => (
      <NumberField.Root data-testid="root">
        <NumberField.ScrubArea data-testid="scrubArea" />
        <NumberField.Group data-testid="group">
          <NumberField.Decrement data-testid="decrement" />
          <NumberField.Input data-testid="input" />
          <NumberField.Increment data-testid="increment" />
        </NumberField.Group>
      </NumberField.Root>
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
    const cost = libraryCost(part);
    expect(cost, `${part} ${cost} nodes, floor ${floorCost(part)}`).toBeLessThanOrEqual(
      BUDGET[part],
    );
  });
});
