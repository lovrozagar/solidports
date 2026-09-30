import { createUniqueId } from "solid-js";
import { OTPField } from "@solidports/base-ui/otp-field";
import styles from "./index.module.css";

export default function ExampleOTPField() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;

  return (
    <div class={styles.Field}>
      <label for={id} class={styles.Label}>
        Verification code
      </label>
      <OTPField.Root
        id={id}
        length={6}
        aria-describedby={descriptionId}
        class={styles.Root}
      >
        <OTPField.Input class={styles.Input} aria-label="Character 1 of 6" />
        <OTPField.Input class={styles.Input} aria-label="Character 2 of 6" />
        <OTPField.Input class={styles.Input} aria-label="Character 3 of 6" />
        <OTPField.Input class={styles.Input} aria-label="Character 4 of 6" />
        <OTPField.Input class={styles.Input} aria-label="Character 5 of 6" />
        <OTPField.Input class={styles.Input} aria-label="Character 6 of 6" />
      </OTPField.Root>
      <p id={descriptionId} class={styles.Description}>
        Enter the 6-character code we sent to your device.
      </p>
    </div>
  );
}
