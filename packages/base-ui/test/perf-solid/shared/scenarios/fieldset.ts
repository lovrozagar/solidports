import { qa } from '../drivers';
import type { Scenario } from '../types';

const disabled = () => qa('fieldset[disabled]').length;

const scenarios: Scenario[] = [
  {
    // Plan 3 leaf 1.13: Fieldset's first scenario.
    id: 'fieldset/300',
    fixture: 'fieldset/300',
    components: ['fieldset'],
    tags: ['scale-100', 'reactive-props'],
    steps: [
      {
        name: 'disable all',
        run: (ctx) => ctx.lib.set('disabled', true),
        settle: true,
        verify: disabled,
      },
      {
        name: 'enable all',
        run: (ctx) => ctx.lib.set('disabled', false),
        settle: true,
        verify: disabled,
      },
    ],
  },
];

export default scenarios;
