import { renderToString } from '@solidjs/web';
import { SliderBudget } from './slider.fixture';

export function render(): string {
  return renderToString(() => <SliderBudget count={2} />);
}
