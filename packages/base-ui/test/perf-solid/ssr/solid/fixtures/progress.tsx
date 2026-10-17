import { fixtures as statics } from '../../../solid/fixtures/static';

export const fixtures: Record<string, () => unknown> = {
  'progress/1000': statics['static/progress-meter'],
};
