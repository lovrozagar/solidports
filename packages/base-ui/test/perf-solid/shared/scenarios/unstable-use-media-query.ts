import type { Scenario } from '../types';

const scenarios: Scenario[] = [
  {
    // Plan 3 leaf 1.13: the unstable useMediaQuery hook's first scenario, 1000 readers of one
    // query mounted and unmounted.
    id: 'unstable-use-media-query/1000',
    fixture: 'unstable-use-media-query/1000',
    components: ['unstable-use-media-query'],
    tags: ['scale-1000'],
    steps: [],
  },
];

export default scenarios;
