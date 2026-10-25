import { renderToString } from '@solidjs/web';
import { NumberFieldFixture } from './number-field.fixture';

export function render(): string {
  return renderToString(() => <NumberFieldFixture />);
}
