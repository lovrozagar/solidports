import { Slider } from '@solidports/base-ui/slider';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  label: () => (
    <Slider.Root defaultValue={30} data-testid="root">
      <Slider.Label data-testid="label">Volume</Slider.Label>
      <Slider.Control>
        <Slider.Track>
          <Slider.Thumb />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  ),
});
