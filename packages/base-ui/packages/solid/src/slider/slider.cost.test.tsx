/* eslint-disable testing-library/no-container -- reads the parts by test id within the render */
/*
 * A slider against the hand-written floor (`test/floor/slider.tsx`, D32's sweep): Root, Label,
 * Value, Control, Track, Indicator and Thumb render on the native path with the floor's DOM, and the
 * dev runtime's reactive nodes each part adds stay at its native budget. The parts render natively
 * on the client only: while hydrating, the slider's prehydration script positions them.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Slider } from '@solidports/base-ui/slider';
import { createRenderer, isJSDOM } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import {
  FloorSliderControl,
  FloorSliderIndicator,
  FloorSliderLabel,
  FloorSliderRoot,
  FloorSliderThumb,
  FloorSliderTrack,
  FloorSliderValue,
} from '../../test/floor/slider';

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
  root: 18, // slow 37, floor 9
  label: 4, // slow 21, floor 4
  value: 6, // slow 24, floor 4
  control: 5, // slow 23, floor 3
  track: 2, // slow 20, floor 4
  indicator: 3, // slow 22, floor 4
  thumb: 19, // slow 38, floor 6
};

type Part = keyof typeof BUDGET;

/** A part's shape: its parent chain (Root, Control, Track) and the part inside it. */
interface Shape {
  /** The root alone, rendered directly (the wrapper below adds its own nodes). */
  bare: () => JSX.Element;
  Root: (props: { defaultValue: number; children?: JSX.Element }) => JSX.Element;
  Control: (props: { children?: JSX.Element }) => JSX.Element;
  Track: (props: { children?: JSX.Element }) => JSX.Element;
  parts: Record<Exclude<Part, 'root'>, () => JSX.Element>;
}

const library: Shape = {
  bare: () => <Slider.Root defaultValue={20} />,
  Root: (props) => <Slider.Root defaultValue={props.defaultValue}>{props.children}</Slider.Root>,
  Control: (props) => <Slider.Control>{props.children}</Slider.Control>,
  Track: (props) => <Slider.Track>{props.children}</Slider.Track>,
  parts: {
    label: () => <Slider.Label>Volume</Slider.Label>,
    value: () => <Slider.Value />,
    control: () => <Slider.Control />,
    track: () => <Slider.Track />,
    indicator: () => <Slider.Indicator />,
    thumb: () => <Slider.Thumb />,
  },
};

const floor: Shape = {
  bare: () => <FloorSliderRoot defaultValue={20} />,
  Root: (props) => (
    <FloorSliderRoot defaultValue={props.defaultValue}>{props.children}</FloorSliderRoot>
  ),
  Control: (props) => <FloorSliderControl>{props.children}</FloorSliderControl>,
  Track: (props) => <FloorSliderTrack>{props.children}</FloorSliderTrack>,
  parts: {
    label: () => <FloorSliderLabel>Volume</FloorSliderLabel>,
    value: () => <FloorSliderValue />,
    control: () => <FloorSliderControl />,
    track: () => <FloorSliderTrack />,
    indicator: () => <FloorSliderIndicator />,
    thumb: () => <FloorSliderThumb />,
  },
};

describe('slider cost against the hand-written floor', () => {
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

  /** The part's nodes: its tree less the same tree without it. */
  function cost(shape: Shape, part: Part) {
    const { Root, Control, Track, parts } = shape;
    const inside = (child?: () => JSX.Element) => {
      if (part === 'indicator' || part === 'thumb') {
        return () => (
          <Root defaultValue={20}>
            <Control>
              <Track>{child?.()}</Track>
            </Control>
          </Root>
        );
      }
      if (part === 'track') {
        return () => (
          <Root defaultValue={20}>
            <Control>{child?.()}</Control>
          </Root>
        );
      }
      return () => <Root defaultValue={20}>{child?.()}</Root>;
    };
    if (part === 'root') {
      return perCopy(shape.bare);
    }
    return perCopy(inside(parts[part])) - perCopy(inside());
  }

  // Solid: a browser rewrites inline style declarations and the range input's value attribute.
  it.skipIf(!isJSDOM)('the floor renders the same DOM as a slider', () => {
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
    const tree = (shape: Shape) => () => {
      const { Root, Control, Track, parts } = shape;
      return (
        <Root defaultValue={20}>
          {parts.label()}
          {parts.value()}
          <Control>
            <Track>
              {parts.indicator()}
              {parts.thumb()}
            </Track>
          </Control>
        </Root>
      );
    };
    expect(html(tree(floor))).toBe(html(tree(library)));
  });

  it("a slider's parts render on the native path", () => {
    const view = render(() => (
      <Slider.Root defaultValue={20} data-testid="root">
        <Slider.Label data-testid="label">Volume</Slider.Label>
        <Slider.Value data-testid="value" />
        <Slider.Control data-testid="control">
          <Slider.Track data-testid="track">
            <Slider.Indicator data-testid="indicator" />
            <Slider.Thumb data-testid="thumb" />
          </Slider.Track>
        </Slider.Control>
      </Slider.Root>
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
