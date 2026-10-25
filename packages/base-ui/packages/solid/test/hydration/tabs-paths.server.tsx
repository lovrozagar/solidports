import { renderToString } from '@solidjs/web';
import { TabsPathsFixture } from './tabs.fixture';

export function render(): string {
  return renderToString(() => <TabsPathsFixture />);
}
