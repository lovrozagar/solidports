import type { ComponentProps, JSX } from '@solidjs/web';
import { Checkbox } from '@solidports/base-ui/checkbox';
import styles from './index.module.css';

export default function ExampleCheckbox() {
  return (
    <label class={styles.Label}>
      <Checkbox.Root defaultChecked class={styles.Checkbox}>
        <Checkbox.Indicator class={styles.Indicator}>
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      Enable notifications
    </label>
  );
}
function CheckIcon(props: ComponentProps<'svg'>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      {...props}
      style={{
        display: 'block',
        ...(props.style as JSX.CSSProperties),
      }}
    >
      <path d="m2.5 8.5 4 4 7-9" />
    </svg>
  );
}
