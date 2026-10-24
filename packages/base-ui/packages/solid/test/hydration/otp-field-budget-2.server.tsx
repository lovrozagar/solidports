import { renderToString } from '@solidjs/web';
import { OTPFieldBudget } from './otp-field.fixture';

export function render(): string {
  return renderToString(() => <OTPFieldBudget count={2} />);
}
