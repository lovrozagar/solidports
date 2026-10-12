import { createSignal } from 'solid-js';
import { expect, vi, describe, it } from 'vitest';
import { fireEvent, screen } from '@solidjs/testing-library';
import { NumberField } from '@solidports/base-ui/number-field';
import { act, createRenderer, describeConformance, isJSDOM } from '#test-utils';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

describe('<NumberField.Decrement />', () => {
  const { render, clock } = createRenderer();

  describeConformance(NumberField.Decrement, () => ({
    refInstanceof: window.HTMLButtonElement,
    testComponentPropWith: 'button',
    button: true,
    render: (node, props) => render(() => <NumberField.Root>{node(props!)}</NumberField.Root>),
  }));

  describe('prop: snapOnStep', () => {
    it('should decrement by exact step without rounding when snapOnStep is false', async () => {
      render(() => (
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue((0.7).toLocaleString());
    });

    it('should snap on decrement when snapOnStep is true', async () => {
      render(() => (
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('1');

      fireEvent.input(screen.getByRole('textbox'), { target: { value: '1.9' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('1');

      fireEvent.input(screen.getByRole('textbox'), { target: { value: '-0.2' } });
      fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('-1');
    });

    it('should decrement with respect to the min value', async () => {
      render(() => (
        <NumberField.Root defaultValue={8} min={1} step={2} snapOnStep>
          <NumberField.Decrement />
          <NumberField.Input />
        </NumberField.Root>
      ));

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      fireEvent.click(button);
      expect(input).toHaveValue('7');

      fireEvent.click(button);
      expect(input).toHaveValue('5');

      fireEvent.input(input, { target: { value: '9.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('9');

      fireEvent.input(input, { target: { value: '1.112' } });
      fireEvent.click(button);
      expect(input).toHaveValue('1');
    });
  });
});
