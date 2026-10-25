import { renderToString } from '@solidjs/web';
import { ButtonBudget } from './button.fixture';

export function render(): string {
  return renderToString(() => <ButtonBudget count={1} />);
}
