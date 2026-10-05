import { For } from 'solid-js';
import { OTPField as OTPFieldBase } from '@solidports/base-ui/otp-field';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

const OTP_LENGTH = 6;

export default defineSsrFixtures(import.meta.url, {
  alphanumeric: () => (
    <OTPFieldBase.Root name="otp" required length={OTP_LENGTH} validationType="alphanumeric">
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
    </OTPFieldBase.Root>
  ),
  uniqueIds: () => (
    <OTPFieldBase.Root data-testid="root" id="verification-code" length={OTP_LENGTH}>
      <For each={Array.from({ length: OTP_LENGTH }, (_, index) => index)}>
        {() => <OTPFieldBase.Input />}
      </For>
    </OTPFieldBase.Root>
  ),
  hiddenInput: () => (
    <OTPFieldBase.Root name="otp" required length={OTP_LENGTH}>
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
      <OTPFieldBase.Input />
    </OTPFieldBase.Root>
  ),
});
