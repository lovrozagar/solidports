import type { Scenario } from '../types';

const scenarios: Scenario[] = [
  {
    id: 'button/raw-1000',
    fixture: 'button/raw',
    components: ['button'],
    tags: ['scale-1000', 'static-props', 'raw'],
    steps: [],
  },
  {
    id: 'button/button-1000',
    fixture: 'button/list',
    components: ['button'],
    tags: ['scale-1000', 'static-props'],
    steps: [],
  },
];

export default scenarios;
