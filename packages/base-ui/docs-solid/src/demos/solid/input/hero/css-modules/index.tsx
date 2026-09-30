import { Input } from '@solidports/base-ui/input';
import styles from './index.module.css';

export default function ExampleInput() {
  return (
    <label class={styles.Label}>
      Name
      <Input placeholder="Enter your name" class={styles.Input} />
    </label>
  );
}
