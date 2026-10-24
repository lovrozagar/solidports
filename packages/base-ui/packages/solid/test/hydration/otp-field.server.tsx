import { renderToString } from '@solidjs/web';
import { OTPFieldFixture } from './otp-field.fixture';

export function render(): string {
  return renderToString(() => <OTPFieldFixture />);
}
