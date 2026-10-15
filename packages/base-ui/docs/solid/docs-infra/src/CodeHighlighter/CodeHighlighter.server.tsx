import { renderToString } from '@solidjs/web';
import { CodeBlocksFixture } from './CodeHighlighter.fixture';

export function render(): string {
  return renderToString(() => <CodeBlocksFixture />);
}
