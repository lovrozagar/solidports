// Raw floors for the disclosure parts: the same DOM hand-written in each framework
// (`*/fixtures/raw-disclosure.tsx`), driven like the part scenarios.
import { click, qa } from '../drivers';
import type { Scenario } from '../types';

const expanded = () => qa('[aria-expanded="true"]').length;
const all = () => Array.from({ length: qa('[aria-expanded]').length }, (_, i) => `item-${i}`);
const selected = () => ({
  tab: qa('[role="tab"][aria-selected="true"]').map((el) => el.textContent),
  panels: qa('[role="tabpanel"]').length,
});

const scenarios: Scenario[] = [
  {
    id: 'collapsible/raw-300',
    fixture: 'collapsible/raw-300',
    steps: [
      { name: 'open all', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: expanded },
      { name: 'close all', run: (ctx) => ctx.lib.set('open', false), settle: true, verify: expanded },
    ],
  },
  {
    id: 'collapsible/raw-300-for',
    fixture: 'collapsible/raw-300-for',
    steps: [
      { name: 'open all', run: (ctx) => ctx.lib.set('open', true), settle: true, verify: expanded },
      { name: 'close all', run: (ctx) => ctx.lib.set('open', false), settle: true, verify: expanded },
    ],
  },
  {
    id: 'collapsible/raw-300-uncontrolled',
    fixture: 'collapsible/raw-300-uncontrolled',
    steps: [
      { name: 'click 1', run: () => click(qa('[aria-expanded]')[150]), settle: true, verify: expanded },
    ],
  },
  {
    id: 'accordion/raw-300',
    fixture: 'accordion/raw-300',
    steps: [
      { name: 'open one', run: (ctx) => ctx.lib.set('value', ['item-150']), settle: true, verify: expanded },
      { name: 'open all', run: (ctx) => ctx.lib.set('value', all()), settle: true, verify: expanded },
      { name: 'close all', run: (ctx) => ctx.lib.set('value', []), settle: true, verify: expanded },
    ],
  },
  {
    id: 'tabs/raw-200',
    fixture: 'tabs/raw-200',
    steps: [
      { name: 'switch tab', run: (ctx) => ctx.lib.set('value', 'item-150'), settle: true, verify: selected },
      { name: 'click tab 150', run: () => click(qa('[role="tab"]')[150]), settle: true, verify: selected },
    ],
  },
];

export default scenarios;
