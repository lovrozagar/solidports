import { renderToString } from '@solidjs/web';
import { FieldControlBudget } from './field-control.fixture';

export function render(): string {
  return renderToString(() => <FieldControlBudget count={2} />);
}
