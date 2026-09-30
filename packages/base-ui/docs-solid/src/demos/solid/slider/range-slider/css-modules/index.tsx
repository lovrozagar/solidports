import { Slider } from '@solidports/base-ui/slider';
import styles from './index.module.css';

export default function RangeSlider() {
  return (
    <Slider.Root defaultValue={[25, 45]}>
      <Slider.Control class={styles.Control}>
        <Slider.Track class={styles.Track}>
          <Slider.Indicator class={styles.Indicator} />
          <Slider.Thumb index={0} class={styles.Thumb} />
          <Slider.Thumb index={1} class={styles.Thumb} />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}
