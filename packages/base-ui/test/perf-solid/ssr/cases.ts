import type { ComponentName, ScenarioTag } from '../shared/manifest';

export interface SsrCase {
  /** `<component>/<name>`; both libraries register a fixture under it in `<lib>/fixtures/<component>.tsx`. */
  id: string;
  /** Components the case measures, primary first (`shared/manifest.ts`). */
  components: readonly [ComponentName, ...ComponentName[]];
  /** Coverage dimensions, always including `ssr` and `hydrate`. */
  tags: readonly ScenarioTag[];
  /**
   * The click TTI and INP measure (D29): absent where the fixture cannot respond (a controlled value
   * with no handler, or nothing to click).
   */
  interaction?: SsrInteraction;
}

/**
 * One user interaction, shared by TTI (the first click whose effect appears) and INP (that click and
 * a warm second one, after the undo).
 */
export interface SsrInteraction {
  /** The element clicked: the first match. */
  trigger: string;
  /**
   * What only the library's JavaScript produces: the attribute value on `selector` (default: the
   * clicked element), or `selector` matching nothing once the click lands.
   */
  effect: { selector?: string; attribute?: string; value?: string; absent?: boolean };
  /** Undoing the effect before the warm click: the trigger again, Escape, or a click elsewhere. */
  undo: 'toggle' | 'escape' | { click: string };
}

const expands = (trigger: string, undo: SsrInteraction['undo']): SsrInteraction => ({
  trigger,
  effect: { attribute: 'aria-expanded', value: 'true' },
  undo,
});

/** Server render and hydration cases; `scripts/base-ui-perf-manifest.test.ts` checks them. */
export const ssrCases: readonly SsrCase[] = [
  {
    id: 'accordion/300',
    components: ['accordion'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
    interaction: expands('button[aria-expanded]', 'toggle'),
  },
  {
    id: 'accordion/300-floor',
    components: ['accordion'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
  },
  {
    id: 'accordion/300-open',
    components: ['accordion'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled', 'open'],
  },
  {
    id: 'accordion/300-open-floor',
    components: ['accordion'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled', 'open'],
  },
  {
    id: 'checkbox/1000',
    components: ['checkbox'],
    tags: ['ssr', 'hydrate', 'scale-1000', 'uncontrolled'],
    interaction: {
      trigger: '[role="checkbox"]',
      effect: { attribute: 'aria-checked', value: 'true' },
      undo: 'toggle',
    },
  },
  {
    id: 'collapsible/300',
    components: ['collapsible'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
  },
  {
    id: 'collapsible/300-floor',
    components: ['collapsible'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
  },
  {
    id: 'collapsible/300-open',
    components: ['collapsible'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled', 'open'],
  },
  {
    id: 'collapsible/300-open-floor',
    components: ['collapsible'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled', 'open'],
  },
  {
    id: 'dialog/page',
    components: ['dialog'],
    tags: ['ssr', 'hydrate', 'scale-1', 'uncontrolled', 'open', 'portal'],
    // Open by default: the first click closes it, and the trigger reopens it.
    interaction: {
      trigger: '[role="dialog"] button',
      effect: { selector: '[role="dialog"]', absent: true },
      undo: { click: '[data-testid="dialog-trigger"]' },
    },
  },
  {
    id: 'menu/page',
    components: ['menu'],
    tags: ['ssr', 'hydrate', 'scale-1', 'controlled', 'portal'],
    interaction: expands('[data-testid="trigger"]', 'escape'),
  },
  {
    id: 'popover/page',
    components: ['popover'],
    tags: ['ssr', 'hydrate', 'scale-100', 'uncontrolled', 'portal'],
    interaction: expands('button[aria-haspopup]', 'escape'),
  },
  { id: 'form/50', components: ['form', 'field'], tags: ['ssr', 'hydrate', 'scale-100'] },
  {
    id: 'select/1000',
    components: ['select'],
    tags: ['ssr', 'hydrate', 'scale-1000', 'controlled', 'portal'],
    interaction: expands('[aria-haspopup="listbox"]', 'escape'),
  },
  {
    id: 'tabs/200',
    components: ['tabs'],
    tags: ['ssr', 'hydrate', 'scale-100', 'controlled'],
    interaction: {
      trigger: '[role="tab"][aria-selected="false"]',
      effect: { attribute: 'aria-selected', value: 'true' },
      undo: { click: '[role="tab"]' },
    },
  },
  {
    id: 'progress/1000',
    components: ['progress', 'meter'],
    tags: ['ssr', 'hydrate', 'scale-1000', 'controlled'],
  },
  {
    id: 'input/1000',
    components: ['input', 'separator'],
    tags: ['ssr', 'hydrate', 'scale-1000', 'uncontrolled'],
  },
  { id: 'avatar/1000', components: ['avatar'], tags: ['ssr', 'hydrate', 'scale-1000'] },
];
