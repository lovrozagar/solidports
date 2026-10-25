import { renderToString } from '@solidjs/web';
import { ScriptedTabs } from './tabs.fixture';

export function render(): string {
  return renderToString(() => <ScriptedTabs slow={false} />);
}
