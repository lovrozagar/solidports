import { fixtures as overlays } from '../../../solid/fixtures/overlays';

export const fixtures: Record<string, () => unknown> = {
  'popover/page': overlays['popover/roots'],
};
