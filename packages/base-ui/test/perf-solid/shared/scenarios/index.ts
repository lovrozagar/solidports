import type { Scenario } from '../types';

// Every `*.ts` group in this folder default-exports its scenarios.
const groups = import.meta.glob<{ default: Scenario[] }>('./*.ts', { eager: true });

export const scenarios: Scenario[] = Object.entries(groups)
  .filter(([path]) => !path.endsWith('/index.ts'))
  .sort(([a], [b]) => a.localeCompare(b))
  .flatMap(([, module]) => module.default);
