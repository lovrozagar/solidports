import { renderToString } from '@solidjs/web';
import { ScriptedSliders } from './slider.fixture';

export function render(): string {
  return renderToString(() => <ScriptedSliders slow={true} />);
}
