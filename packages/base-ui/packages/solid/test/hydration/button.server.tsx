import { renderToString } from '@solidjs/web';
import { ButtonFixture } from './button.fixture';

export function render(): string {
  return renderToString(() => <ButtonFixture />);
}
