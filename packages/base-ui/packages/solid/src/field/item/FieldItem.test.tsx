import { createRenderer } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Field } from '@solidports/base-ui/field';
import { Radio } from '@solidports/base-ui/radio';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { screen } from '@solidjs/testing-library';
import type { JSX } from '@solidjs/web';
import { spy } from 'sinon';
import { expect, vi } from 'vitest';
import { describeConformance } from '../../../test/describeConformance';

describe('<Field.Item />', () => {
  const { render } = createRenderer();

  describeConformance(Field.Item, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node, props) {
      return render(() => <Field.Root>{node(props!)}</Field.Root>);
    },
  }));

  describe('prop: disabled', () => {
    it('reflects disabled state on the item', () => {
      const renderItem = vi.fn();
      function renderFieldItem(props: JSX.HTMLAttributes<HTMLDivElement>, state: Field.Item.State) {
        renderItem({ ...state });
        return <div {...props} />;
      }

      render(() => (
        <Field.Root>
          <Field.Item disabled data-testid="item" render={renderFieldItem} />
        </Field.Root>
      ));

      expect(screen.getByTestId('item')).to.have.attribute('data-disabled');
      expect(renderItem.mock.lastCall?.[0].disabled).to.equal(true);
    });

    it('disables a wrapped checkbox', async () => {
      const onValueChange = spy();
      const { user } = render(() => (
        <Field.Root name="apple">
          <CheckboxGroup defaultValue={[]} onValueChange={onValueChange}>
            <Field.Item disabled>
              <Checkbox.Root value="fuji-apple" />
            </Field.Item>
            <Field.Item>
              <Checkbox.Root value="gala-apple" />
            </Field.Item>
          </CheckboxGroup>
        </Field.Root>
      ));
      const [checkbox1, checkbox2] = screen.getAllByRole('checkbox');
      await user.click(checkbox1);
      expect(onValueChange.callCount).to.equal(0);
      await user.click(checkbox2);
      expect(onValueChange.callCount).to.equal(1);
    });

    it('disables a wrapped radio', async () => {
      const onValueChange = spy();
      const { user } = render(() => (
        <Field.Root name="apple">
          <RadioGroup defaultValue="" onValueChange={onValueChange}>
            <Field.Item disabled>
              <Radio.Root value="fuji-apple" />
            </Field.Item>
            <Field.Item>
              <Radio.Root value="gala-apple" />
            </Field.Item>
          </RadioGroup>
        </Field.Root>
      ));
      const [radio1, radio2] = screen.getAllByRole('radio');
      await user.click(radio1);
      expect(onValueChange.callCount).to.equal(0);
      await user.click(radio2);
      expect(onValueChange.callCount).to.equal(1);
    });
  });

  it('associates a Field.Item label with a parent checkbox', async () => {
    const { user } = render(() => (
      <Field.Root>
        <CheckboxGroup allValues={['a', 'b']}>
          <Field.Item>
            <Field.Label>
              <Checkbox.Root parent data-testid="parent" />
              Toggle all
            </Field.Label>
          </Field.Item>
          <Checkbox.Root value="a" data-testid="a" />
          <Checkbox.Root value="b" data-testid="b" />
        </CheckboxGroup>
      </Field.Root>
    ));

    const label = screen.getByText('Toggle all').closest('label') as HTMLLabelElement;
    const parent = screen.getByTestId('parent');

    expect(label).to.have.attribute('for');
    expect(label.control).to.have.attribute('type', 'checkbox');
    await user.click(screen.getByText('Toggle all'));
    expect(parent).to.have.attribute('aria-checked', 'true');
    expect(screen.getByTestId('a')).to.have.attribute('aria-checked', 'true');
    expect(screen.getByTestId('b')).to.have.attribute('aria-checked', 'true');
  });
});
