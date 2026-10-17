import { fixtures as statics } from '../../../solid/fixtures/static';

export const fixtures: Record<string, () => unknown> = {
  'input/1000': statics['static/separator-input'],
};
