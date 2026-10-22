/* eslint-disable testing-library/no-container -- reads the parts by test id within the render */
/*
 * A field in a fieldset against the hand-written floor (`test/floor/field.tsx`, D32's sweep):
 * Fieldset.Root and Legend, Field.Root, Label, Control and Description render on the native path
 * with the floor's DOM, a valid Field.Error renders nothing, and the dev runtime's reactive nodes
 * each part adds stay at its native budget.
 */
import { DEV, flush } from 'solid-js';
import { afterEach, describe, expect, it } from 'vitest';
import { Field } from '@solidports/base-ui/field';
import { Fieldset } from '@solidports/base-ui/fieldset';
import { Form } from '@solidports/base-ui/form';
import { createRenderer } from '#test-utils';
import type { JSX } from '@solidjs/web';
import { renderPathOf } from '../utils/renderPath';
import { normalizeTree } from '../../test/parityHarness';
import {
  FloorFieldControl,
  FloorFieldDescription,
  FloorFieldError,
  FloorFieldLabel,
  FloorFieldRoot,
  FloorFieldsetLegend,
  FloorFieldsetRoot,
  FloorForm,
} from '../../test/floor/field';

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
  form: 5, // slow 14, floor 3
  fieldsetRoot: 3, // slow 13, floor 10
  legend: 4, // slow 11, floor 3
  fieldRoot: 16, // slow 26, floor 9
  label: 6, // slow 13, floor 4
  control: 14, // slow 34, floor 3
  description: 4, // slow 11, floor 3
  error: 10, // slow 15, floor 6
};

type Part = keyof typeof BUDGET;

describe('field cost against the hand-written floor', () => {
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

  const library: Record<Part, [() => JSX.Element, () => JSX.Element]> = {
    form: [() => <Form />, () => null],
    fieldsetRoot: [() => <Fieldset.Root />, () => null],
    legend: [
      () => (
        <Fieldset.Root>
          <Fieldset.Legend>Legend</Fieldset.Legend>
        </Fieldset.Root>
      ),
      () => <Fieldset.Root />,
    ],
    fieldRoot: [() => <Field.Root />, () => null],
    label: [
      () => (
        <Field.Root>
          <Field.Label>Name</Field.Label>
        </Field.Root>
      ),
      () => <Field.Root />,
    ],
    control: [
      () => (
        <Field.Root>
          <Field.Control />
        </Field.Root>
      ),
      () => <Field.Root />,
    ],
    description: [
      () => (
        <Field.Root>
          <Field.Description>Help</Field.Description>
        </Field.Root>
      ),
      () => <Field.Root />,
    ],
    error: [
      () => (
        <Field.Root>
          <Field.Error />
        </Field.Root>
      ),
      () => <Field.Root />,
    ],
  };
  const floor: Record<Part, [() => JSX.Element, () => JSX.Element]> = {
    form: [() => <FloorForm />, () => null],
    fieldsetRoot: [() => <FloorFieldsetRoot />, () => null],
    legend: [
      () => (
        <FloorFieldsetRoot>
          <FloorFieldsetLegend>Legend</FloorFieldsetLegend>
        </FloorFieldsetRoot>
      ),
      () => <FloorFieldsetRoot />,
    ],
    fieldRoot: [() => <FloorFieldRoot />, () => null],
    label: [
      () => (
        <FloorFieldRoot>
          <FloorFieldLabel>Name</FloorFieldLabel>
        </FloorFieldRoot>
      ),
      () => <FloorFieldRoot />,
    ],
    control: [
      () => (
        <FloorFieldRoot>
          <FloorFieldControl />
        </FloorFieldRoot>
      ),
      () => <FloorFieldRoot />,
    ],
    description: [
      () => (
        <FloorFieldRoot>
          <FloorFieldDescription>Help</FloorFieldDescription>
        </FloorFieldRoot>
      ),
      () => <FloorFieldRoot />,
    ],
    error: [
      () => (
        <FloorFieldRoot>
          <FloorFieldError />
        </FloorFieldRoot>
      ),
      () => <FloorFieldRoot />,
    ],
  };
  const cost = (shapes: Record<Part, [() => JSX.Element, () => JSX.Element]>, part: Part) =>
    perCopy(shapes[part][0]) - perCopy(shapes[part][1]);

  it('the floor renders the same DOM as a field in a fieldset in a form', () => {
    const html = (ui: () => JSX.Element) => {
      const view = render(ui);
      flush();
      const tree = normalizeTree(view.container);
      view.unmount();
      return tree;
    };
    expect(
      html(() => (
        <FloorForm>
          <FloorFieldsetRoot>
            <FloorFieldsetLegend>Legend</FloorFieldsetLegend>
            <FloorFieldRoot>
              <FloorFieldLabel>Name</FloorFieldLabel>
              <FloorFieldControl />
              <FloorFieldDescription>Help</FloorFieldDescription>
              <FloorFieldError />
            </FloorFieldRoot>
          </FloorFieldsetRoot>
        </FloorForm>
      )),
    ).toBe(
      html(() => (
        <Form>
          <Fieldset.Root>
            <Fieldset.Legend>Legend</Fieldset.Legend>
            <Field.Root>
              <Field.Label>Name</Field.Label>
              <Field.Control />
              <Field.Description>Help</Field.Description>
              <Field.Error />
            </Field.Root>
          </Fieldset.Root>
        </Form>
      )),
    );
  });

  it("a field's parts render on the native path", () => {
    const view = render(() => (
      <Form data-testid="form">
        <Fieldset.Root data-testid="fieldsetRoot">
          <Fieldset.Legend data-testid="legend">Legend</Fieldset.Legend>
          <Field.Root data-testid="fieldRoot">
            <Field.Label data-testid="label">Name</Field.Label>
            <Field.Control data-testid="control" />
            <Field.Description data-testid="description">Help</Field.Description>
          </Field.Root>
        </Fieldset.Root>
      </Form>
    ));
    flush();
    const names = [
      'form',
      'fieldsetRoot',
      'legend',
      'fieldRoot',
      'label',
      'control',
      'description',
    ];
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
