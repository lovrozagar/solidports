import { renderToString } from '@solidjs/web';
import { FormStateFixture } from './form-state.fixture';

export function render(): string {
  return renderToString(() => <FormStateFixture />);
}
