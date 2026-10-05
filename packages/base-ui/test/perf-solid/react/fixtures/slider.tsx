import * as React from 'react';
import { Slider } from '@base-ui/react/slider';
import { size } from '../../shared/sizes';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function SliderRange() {
  return (
    <Slider.Root data-testid="range" defaultValue={[25, 45]}>
      <Slider.Control data-testid="range-control" style={{ width: '400px', height: '20px' }}>
        <Slider.Track style={{ height: '4px' }}>
          <Slider.Indicator />
          <Slider.Thumb data-testid="range-thumb" index={0} aria-label="Minimum" />
          <Slider.Thumb data-testid="range-thumb" index={1} aria-label="Maximum" />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  );
}

function Sliders() {
  return (
    <div>
      {range(size(100)).map((i) => (
        <Slider.Root key={i} defaultValue={i % 100}>
          <Slider.Control style={{ width: '200px', height: '16px' }}>
            <Slider.Track style={{ height: '4px' }}>
              <Slider.Indicator />
              <Slider.Thumb aria-label={`Slider ${i}`} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
      ))}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'slider/range': SliderRange,
  'slider/100': Sliders,
};
