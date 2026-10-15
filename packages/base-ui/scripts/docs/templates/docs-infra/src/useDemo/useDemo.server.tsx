import { renderToString } from '@solidjs/web';
import { DemoFixture } from './useDemo.fixture';

export function render(): string {
  return renderToString(() => <DemoFixture />);
}
