import { createMemo, createUniqueId, For } from 'solid-js';
import { OTPField } from '@solidports/base-ui/otp-field';
import { useInvalidFeedback } from '../useInvalidFeedback';
import styles from './index.module.css';

const CODE_LENGTH = 6;
function normalizeRecoveryCode(value: string) {
  return value.toUpperCase();
}
function getInvalidClassName(invalidPulse: number, evenClassName: string, oddClassName: string) {
  if (invalidPulse === 0) {
    return '';
  }
  return invalidPulse % 2 === 0 ? evenClassName : oddClassName;
}
export default function OTPFieldCustomNormalizeDemo() {
  const id = createUniqueId();
  const descriptionId = `${id}-description`;
  const _useInvalidFeedback = useInvalidFeedback();
  const _useInvalidFeedback2 = createMemo(() => {
    const {
      activeInvalidIndex,
      handleValueChange,
      handleValueInvalid,
      invalidPulse,
      setFocusedIndex,
      statusMessage,
    } = _useInvalidFeedback();
    return {
      activeInvalidIndex,
      handleValueChange,
      handleValueInvalid,
      invalidPulse,
      setFocusedIndex,
      statusMessage,
    };
  });
  const invalidClassName = createMemo(() =>
    getInvalidClassName(
      _useInvalidFeedback2().invalidPulse,
      styles.InputInvalidB,
      styles.InputInvalidA,
    ),
  );
  return (
    <div class={styles.Field}>
      <label for={id} class={styles.Label}>
        Recovery code
      </label>
      <OTPField.Root
        id={id}
        length={CODE_LENGTH}
        validationType="alphanumeric"
        normalizeValue={normalizeRecoveryCode}
        onValueChange={_useInvalidFeedback2().handleValueChange}
        onValueInvalid={_useInvalidFeedback2().handleValueInvalid}
        aria-describedby={descriptionId}
        class={styles.Root}
      >
        {Array.from(
          {
            length: CODE_LENGTH,
          },
          (_, index) => (
            <For each={[index]}>
              {() => (
                <OTPField.Input
                  class={`${styles.Input} ${_useInvalidFeedback2().activeInvalidIndex === index ? invalidClassName() : ''}`.trim()}
                  aria-label={index === 0 ? undefined : `Character ${index + 1} of ${CODE_LENGTH}`}
                  onFocus={() => {
                    _useInvalidFeedback2().setFocusedIndex(index);
                  }}
                />
              )}
            </For>
          ),
        )}
      </OTPField.Root>
      <p id={descriptionId} class={styles.Description}>
        Letters and digits only. Letters are converted to uppercase.
      </p>
      <span aria-live="polite" class={styles.ScreenReaderOnly}>
        {_useInvalidFeedback2().statusMessage}
      </span>
    </div>
  );
}
