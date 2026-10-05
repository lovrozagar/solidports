import { q, qa, type } from '../drivers';
import type { Scenario } from '../types';

const input = () => q<HTMLInputElement>('[data-testid="control"]');
const root = () => q('[data-testid="field"]');

const typed = () => ({
  length: input().value.length,
  dirty: root().hasAttribute('data-dirty'),
  filled: root().hasAttribute('data-filled'),
  invalid: root().hasAttribute('data-invalid'),
});

const text = 'the quick brown fox jumps over the lazy dog '.repeat(3).slice(0, 100);

const scenarios: Scenario[] = [
  {
    id: 'field/controlled-typing',
    fixture: 'field/controlled',
    steps: [
      { name: 'type 100 chars', run: (ctx) => type(input(), text, ctx.lib.flush), verify: typed },
    ],
  },
  {
    id: 'field/uncontrolled-typing',
    fixture: 'field/uncontrolled',
    steps: [
      { name: 'type 100 chars', run: (ctx) => type(input(), text, ctx.lib.flush), verify: typed },
    ],
  },
  {
    id: 'field/validate-on-change',
    fixture: 'field/validate-on-change',
    steps: [
      {
        name: 'type 50 chars',
        run: (ctx) => type(input(), text.slice(0, 50), ctx.lib.flush),
        verify: () => ({ ...typed(), errors: qa('[data-testid="error"]').length }),
      },
    ],
  },
];

export default scenarios;
