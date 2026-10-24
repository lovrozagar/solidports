import { click, q, qa, type, yieldTask } from '../drivers';
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
    components: ['field'],
    tags: ['scale-1', 'controlled', 'reactive-props', 'typing'],
    steps: [
      { name: 'type 100 chars', run: (ctx) => type(input(), text, ctx.lib.flush), verify: typed },
    ],
  },
  {
    id: 'field/uncontrolled-typing',
    fixture: 'field/uncontrolled',
    components: ['field'],
    tags: ['scale-1', 'uncontrolled', 'typing'],
    steps: [
      { name: 'type 100 chars', run: (ctx) => type(input(), text, ctx.lib.flush), verify: typed },
    ],
  },
  {
    id: 'field/validate-on-change',
    fixture: 'field/validate-on-change',
    components: ['field'],
    tags: ['scale-1', 'uncontrolled', 'typing'],
    steps: [
      {
        name: 'type 50 chars',
        run: (ctx) => type(input(), text.slice(0, 50), ctx.lib.flush),
        verify: () => ({ ...typed(), errors: qa('[data-testid="error"]').length }),
      },
    ],
  },
  {
    // D33 batch 3: Field.Item's first scenario, a field's checkbox group of 100 items.
    id: 'field/checkbox-items-100',
    fixture: 'field/checkbox-items-100',
    components: ['field'],
    tags: ['scale-100', 'reactive-props', 'pointer'],
    steps: [
      {
        name: 'check 20 by click',
        run: async (ctx) => {
          const boxes = qa('[data-testid="item-checkbox"]');
          for (let i = 0; i < 20; i += 1) {
            click(boxes[i * 5]);
            ctx.lib.flush();
            await yieldTask();
          }
        },
        settle: true,
        verify: () => qa('[data-testid="item-checkbox"][data-checked]').length,
      },
      {
        name: 'disable field',
        run: (ctx) => ctx.lib.set('disabled', true),
        settle: true,
        verify: () => qa('[data-testid="field-item"][data-disabled]').length,
      },
      {
        name: 'enable field',
        run: (ctx) => ctx.lib.set('disabled', false),
        settle: true,
        verify: () => qa('[data-testid="field-item"][data-disabled]').length,
      },
    ],
  },
];

export default scenarios;
