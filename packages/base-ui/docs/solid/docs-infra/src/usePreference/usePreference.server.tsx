import { renderToString } from '@solidjs/web';
import { PreferenceFixture } from './usePreference.fixture';

export function render(): string {
  return renderToString(() => <PreferenceFixture />);
}
