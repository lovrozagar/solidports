import type { ComponentName, ScenarioTag } from '../shared/manifest';

export interface SsrCase {
  /** `<component>/<name>`; both libraries register a fixture under it in `<lib>/fixtures/<component>.tsx`. */
  id: string;
  /** Components the case measures, primary first (`shared/manifest.ts`). */
  components: readonly [ComponentName, ...ComponentName[]];
  /** Coverage dimensions, always including `ssr` and `hydrate`. */
  tags: readonly ScenarioTag[];
}

/** Server render and hydration cases; `scripts/base-ui-perf-manifest.test.ts` checks them. */
export const ssrCases: readonly SsrCase[] = [
  {
    id: 'accordion/300',
    components: ['accordion'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
  },
  {
    id: 'checkbox/1000',
    components: ['checkbox'],
    tags: ['ssr', 'hydrate', 'scale-1000', 'uncontrolled'],
  },
  {
    id: 'collapsible/300',
    components: ['collapsible'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
  },
  {
    id: 'dialog/page',
    components: ['dialog'],
    tags: ['ssr', 'hydrate', 'scale-1', 'uncontrolled', 'open', 'portal'],
  },
  { id: 'form/50', components: ['form', 'field'], tags: ['ssr', 'hydrate', 'scale-100'] },
  {
    id: 'select/1000',
    components: ['select'],
    tags: ['ssr', 'hydrate', 'scale-1000', 'controlled', 'portal'],
  },
  { id: 'tabs/200', components: ['tabs'], tags: ['ssr', 'hydrate', 'scale-100', 'controlled'] },
];
