import { createRenderer } from '#test-utils';
import { OTPField } from '@solidports/base-ui/otp-field';
import { fireEvent, screen } from '@solidjs/testing-library';
import { expect } from 'chai';
import { createSignal } from 'solid-js';

/* Slot 0 intentionally ignores aria-label when a <label> element is present.
   Use data-testid to query inputs without triggering the warning. */
function SixSlotOTP(props: { value?: string; defaultValue?: string; onValueChange?: (v: string) => void }) {
  return (
    <OTPField.Root length={6} value={props.value} defaultValue={props.defaultValue} onValueChange={props.onValueChange}>
      <OTPField.Input data-testid="slot-0" />
      <OTPField.Input data-testid="slot-1" aria-label="Character 2 of 6" />
      <OTPField.Input data-testid="slot-2" aria-label="Character 3 of 6" />
      <OTPField.Input data-testid="slot-3" aria-label="Character 4 of 6" />
      <OTPField.Input data-testid="slot-4" aria-label="Character 5 of 6" />
      <OTPField.Input data-testid="slot-5" aria-label="Character 6 of 6" />
    </OTPField.Root>
  );
}

function getSlots(): HTMLInputElement[] {
  return ['slot-0', 'slot-1', 'slot-2', 'slot-3', 'slot-4', 'slot-5'].map(
    (id) => screen.getByTestId(id) as HTMLInputElement,
  );
}

describe('<OTPField.Root />', () => {
  const { render } = createRenderer();

  describe('slot index assignment', () => {
    it('each slot renders exactly one character from the controlled value', () => {
      render(() => <SixSlotOTP value="123456" />);
      const [s0, s1, s2, s3, s4, s5] = getSlots();
      expect(s0.value).to.equal('1');
      expect(s1.value).to.equal('2');
      expect(s2.value).to.equal('3');
      expect(s3.value).to.equal('4');
      expect(s4.value).to.equal('5');
      expect(s5.value).to.equal('6');
    });

    it('typing into slot 0 sets exactly one character and leaves slot 0 with "1"', async () => {
      const { user } = render(() => <SixSlotOTP />);
      const [s0] = getSlots();

      await user.click(s0);
      fireEvent.input(s0, { target: { value: '1' } });

      expect(s0.value).to.equal('1');
    });

    it('typing a full code into slot 0 distributes one character per slot', async () => {
      const { user } = render(() => <SixSlotOTP />);
      const [s0, s1, s2, s3, s4, s5] = getSlots();

      await user.click(s0);
      /* Slot 0 has maxLength=length, so the browser allows "131431" in one shot */
      fireEvent.input(s0, { target: { value: '131431' } });

      /* replaceOTPValue("", 0, "131431", 6) spreads across all 6 slots */
      expect(s0.value).to.equal('1');
      expect(s1.value).to.equal('3');
      expect(s2.value).to.equal('1');
      expect(s3.value).to.equal('4');
      expect(s4.value).to.equal('3');
      expect(s5.value).to.equal('1');
    });

    it('focus advances to the next slot after single-char input', async () => {
      const { user } = render(() => <SixSlotOTP />);
      const [s0, s1] = getSlots();

      await user.click(s0);
      /* fireEvent.input simulates the browser updating input.value then firing 'input' */
      fireEvent.input(s0, { target: { value: '1' } });

      /* After committing "1" to slot 0, focus must move to slot 1 */
      expect(document.activeElement).to.equal(s1);
    });

    it('paste populates all slots with one character each', async () => {
      render(() => <SixSlotOTP />);
      const [s0, s1, s2, s3, s4, s5] = getSlots();

      fireEvent.paste(s0, {
        clipboardData: { getData: () => '123456' },
      });

      expect(s0.value).to.equal('1');
      expect(s1.value).to.equal('2');
      expect(s2.value).to.equal('3');
      expect(s3.value).to.equal('4');
      expect(s4.value).to.equal('5');
      expect(s5.value).to.equal('6');
    });

    it('controlled value change updates each slot independently', () => {
      function Controlled() {
        const [val, setVal] = createSignal('123456');
        return (
          <div>
            <button onClick={() => setVal('654321')}>swap</button>
            <SixSlotOTP value={val()} />
          </div>
        );
      }

      render(() => <Controlled />);

      const [s0, , , , , s5] = getSlots();
      expect(s0.value).to.equal('1');
      expect(s5.value).to.equal('6');

      fireEvent.click(screen.getByRole('button', { name: 'swap' }));

      expect(s0.value).to.equal('6');
      expect(s5.value).to.equal('1');
    });
  });
});
