import { OTPField } from '@solidports/base-ui/otp-field';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  defaultValue: () => (
    <OTPField.Root defaultValue="42" length={2}>
      <OTPField.Input data-testid="otp-0" />
      <OTPField.Input data-testid="otp-1" />
    </OTPField.Root>
  ),
});
