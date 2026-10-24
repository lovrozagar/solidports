import { renderToString } from '@solidjs/web';
import { SliderFixture } from './slider.fixture';

export function render(): string {
  return renderToString(() => <SliderFixture />);
}
