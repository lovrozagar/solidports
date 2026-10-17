/*
 * Cost budgets for the native static parts: reactive nodes (owners and computations, Solid's dev
 * `onOwner` hook) one more copy of a part adds next to the same tree, beyond a plain element in
 * the same position. The dev runtime wraps every component in one root (`observedComponent`, not
 * in production): a part whose attributes never change costs that root alone, and a part whose
 * attributes follow a reactive source adds its one attribute effect.
 */
import { DEV, flush } from 'solid-js';
import { screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Meter } from '@solidports/base-ui/meter';
import { Progress } from '@solidports/base-ui/progress';
import { Separator } from '@solidports/base-ui/separator';
import { createRenderer, expectNativePath } from '#test-utils';
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

describe('native static part cost', () => {
  const { render } = createRenderer();

  /** Nodes `ui` creates; every element carrying `data-testid="part"` must be native. */
  function nodes(ui: () => JSX.Element) {
    count = 0;
    hooks.onOwner = counting;
    const view = render(ui);
    flush();
    hooks.onOwner = undefined;
    const created = count;
    // The budgets are the native path's: a part that fell back to the slow path fails here.
    for (const element of screen.queryAllByTestId('part')) {
      expectNativePath(element);
    }
    view.unmount();
    return created;
  }

  /**
   * Nodes one extra copy of `item` adds inside `wrap` (includes the parent's insert). `wrap`
   * receives a getter so the items are created inside the wrapper (its contexts).
   */
  function perItem(
    wrap: (items: () => JSX.Element) => JSX.Element,
    item: (index: number) => JSX.Element,
  ) {
    const one = nodes(() => wrap(() => item(0)));
    const two = nodes(() => wrap(() => [item(0), item(1)] as unknown as JSX.Element));
    return two - one;
  }

  const plainDiv = () => <div />;
  const inDiv = (items: () => JSX.Element) => <div>{items()}</div>;
  const inProgress = (items: () => JSX.Element) => (
    <Progress.Root value={40}>{items()}</Progress.Root>
  );
  const inMeter = (items: () => JSX.Element) => <Meter.Root value={40}>{items()}</Meter.Root>;

  function beyondFloor(
    wrap: (items: () => JSX.Element) => JSX.Element,
    item: (index: number) => JSX.Element,
  ) {
    return perItem(wrap, item) - perItem(wrap, plainDiv);
  }

  it('a Separator with a literal orientation costs at most 1 node (dev)', () => {
    // The dev component root; its attributes never change, so it has no attribute effect.
    const BUDGET = 1;
    const cost = beyondFloor(inDiv, () => <Separator data-testid="part" orientation="vertical" />);
    expect(cost, `separator: ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('a Separator with a reactive orientation costs at most 2 nodes (dev)', () => {
    // The dev component root and the attribute effect `aria-orientation` and the state attribute share.
    const BUDGET = 2;
    const orientation = () => 'vertical' as const;
    const cost = beyondFloor(inDiv, () => (
      <Separator data-testid="part" orientation={orientation()} />
    ));
    expect(cost, `separator: ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('a Progress.Track costs at most 2 nodes (dev)', () => {
    // The dev component root and the attribute effect that follows the root's status.
    const BUDGET = 2;
    const cost = beyondFloor(inProgress, () => <Progress.Track data-testid="part" />);
    expect(cost, `progress track: ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('a Progress.Indicator costs at most 2 nodes (dev)', () => {
    // The dev component root and the attribute effect that follows the status and the percentage.
    const BUDGET = 2;
    const cost = beyondFloor(inProgress, () => <Progress.Indicator data-testid="part" />);
    expect(cost, `progress indicator: ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(
      BUDGET,
    );
  });

  it('a Meter.Track costs at most 1 node (dev)', () => {
    // The dev component root: the track has no state and no part attributes.
    const BUDGET = 1;
    const cost = beyondFloor(inMeter, () => <Meter.Track data-testid="part" />);
    expect(cost, `meter track: ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });

  it('a Meter.Indicator costs at most 2 nodes (dev)', () => {
    // The dev component root and the attribute effect that follows the percentage.
    const BUDGET = 2;
    const cost = beyondFloor(inMeter, () => <Meter.Indicator data-testid="part" />);
    expect(cost, `meter indicator: ${cost} nodes beyond a plain div`).toBeLessThanOrEqual(BUDGET);
  });
});
