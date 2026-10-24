/* eslint-disable testing-library/no-container -- compares the two renders' DOM directly */
/*
 * Parity for Field.Item on the native path (D32's sweep): a field's checkbox group renders its
 * items natively, then, alone, forced onto the slow path (`part`), and the two must produce the
 * same normalized document and the same value changes after each step: checking through a label
 * and a checkbox, an item disabled on its own and through the field, and an invalid field. Each
 * item's label points at its own checkbox (the item's labelable provider).
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { createRenderer } from '#test-utils';
import { normalizeTree, part } from '../../../test/parityHarness';
import { renderPathOf } from '../../utils/renderPath';

type Step = () => void;

interface Controls {
  setFieldDisabled: (disabled: boolean) => void;
  setItemDisabled: (disabled: boolean) => void;
  setInvalid: (invalid: boolean) => void;
}

const FRUITS = ['fuji', 'gala', 'honeycrisp'] as const;
const checkbox = (value: string) =>
  document.querySelector<HTMLElement>(`[data-checkbox="${value}"]`)!;
const label = (value: string) => document.querySelector<HTMLElement>(`[data-label="${value}"]`)!;

describe('native parity: field items', () => {
  const { render } = createRenderer();

  async function snapshots(slow: boolean, steps: (controls: Controls) => Step[]) {
    const [fieldDisabled, setFieldDisabled] = createSignal(false);
    const [itemDisabled, setItemDisabled] = createSignal(false);
    const [invalid, setInvalid] = createSignal(false);
    const events: string[] = [];
    const view = render(() => (
      <Field.Root name="apple" disabled={fieldDisabled()} invalid={invalid()}>
        <CheckboxGroup
          defaultValue={[]}
          onValueChange={(value: string[]) => events.push(`value:${value.join('+')}`)}
        >
          {/* eslint-disable-next-line solid/prefer-for -- the items never change */}
          {FRUITS.map((fruit) =>
            part(Field.Item, slow, 'div', {
              'data-item': fruit,
              ...(fruit === 'gala'
                ? {
                    get disabled() {
                      return itemDisabled();
                    },
                  }
                : {}),
              get children() {
                return [
                  <Field.Label data-label={fruit}>{fruit}</Field.Label>,
                  <Checkbox.Root value={fruit} data-checkbox={fruit} />,
                ];
              },
            }),
          )}
        </CheckboxGroup>
      </Field.Root>
    ));
    flush();
    const record = () => {
      const paths = [...document.body.querySelectorAll('[data-item]')].map((el) =>
        renderPathOf(el),
      );
      expect(paths).not.toContain(slow ? 'native' : 'slow');
      return { tree: normalizeTree(document.body), events: events.join(',') };
    };
    const trees = [record()];
    for (const step of steps({ setFieldDisabled, setItemDisabled, setInvalid })) {
      step();
      flush();
      // eslint-disable-next-line no-await-in-loop -- the steps run in order
      await Promise.resolve();
      flush();
      trees.push(record());
    }
    view.unmount();
    view.container.remove();
    return trees;
  }

  it('Field.Item renders the same DOM and value changes through a session', async () => {
    const steps = ({ setFieldDisabled, setItemDisabled, setInvalid }: Controls): Step[] => [
      () => fireEvent.click(checkbox('fuji')),
      () => fireEvent.click(label('gala')),
      () => setItemDisabled(true),
      () => fireEvent.click(checkbox('gala')),
      () => fireEvent.click(label('honeycrisp')),
      () => setInvalid(true),
      () => setItemDisabled(false),
      () => setFieldDisabled(true),
      () => fireEvent.click(checkbox('fuji')),
      () => setFieldDisabled(false),
      () => setInvalid(false),
      () => fireEvent.click(checkbox('gala')),
    ];
    const native = await snapshots(false, steps);
    const slow = await snapshots(true, steps);
    expect(native).toEqual(slow);
  });
});
