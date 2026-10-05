import { Slider } from '@solidports/base-ui/slider';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';

export default defineSsrFixtures(import.meta.url, {
  edgeAligned: () => (
    <Slider.Root defaultValue={30} thumbAlignment="edge" style={{ width: '100px' }}>
      <Slider.Value />
      <Slider.Control>
        <Slider.Track>
          <Slider.Indicator />
          <Slider.Thumb data-testid="thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  ),
  edgeAlignedRange: () => (
    <Slider.Root defaultValue={[30, 40]} thumbAlignment="edge" style={{ width: '100px' }}>
      <Slider.Value />
      <Slider.Control>
        <Slider.Track>
          <Slider.Thumb index={0} data-testid="thumb" />
          <Slider.Thumb index={1} data-testid="thumb" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  ),
});
