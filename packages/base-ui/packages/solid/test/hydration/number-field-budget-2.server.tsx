import { renderToString } from '@solidjs/web';
import { NumberFieldBudget } from './number-field.fixture';

export function render(): string {
  return renderToString(() => <NumberFieldBudget count={2} />);
}
