import { createUniqueId } from "solid-js";
import { OTPField } from "@solidports/base-ui/otp-field";

const inputClass =
  "box-border h-11 w-10 rounded-md border border-gray-200 bg-canvas p-0 text-center text-lg leading-5 tabular-nums text-gray-900 outline-none focus:border-blue-800 focus:outline focus:outline-1 focus:outline-blue-800 data-[filled]:border-gray-300 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-60";

export default function ExampleOTPField() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;

  return (
    <div class="flex flex-col items-start gap-2 text-gray-900">
      <label for={id} class="text-sm leading-5 font-medium">
        Verification code
      </label>
      <OTPField.Root
        id={id}
        length={6}
        aria-describedby={descriptionId}
        class="flex items-center gap-2"
      >
        <OTPField.Input class={inputClass} aria-label="Character 1 of 6" />
        <OTPField.Input class={inputClass} aria-label="Character 2 of 6" />
        <OTPField.Input class={inputClass} aria-label="Character 3 of 6" />
        <OTPField.Input class={inputClass} aria-label="Character 4 of 6" />
        <OTPField.Input class={inputClass} aria-label="Character 5 of 6" />
        <OTPField.Input class={inputClass} aria-label="Character 6 of 6" />
      </OTPField.Root>
      <p id={descriptionId} class="m-0 text-sm leading-5 text-gray-600">
        Enter the 6-character code we sent to your device.
      </p>
    </div>
  );
}
