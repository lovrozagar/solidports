import { renderToString } from '@solidjs/web';
import { PlainHoleFixture } from './plain-hole.fixture';

export function render(): string {
  return renderToString(() => <PlainHoleFixture />);
}
