// Closed vocabularies for scenario metadata. `scripts/base-ui-perf-manifest.test.ts` checks them
// against the package's real exports and every scenario file.

/**
 * Public components: every `@solidports/base-ui` export subpath that renders parts or is a
 * component hook. The manifest test fails when this list and `package.json` `exports` disagree.
 */
export const COMPONENTS = [
  'accordion',
  'alert-dialog',
  'autocomplete',
  'avatar',
  'button',
  'checkbox',
  'checkbox-group',
  'collapsible',
  'combobox',
  'context-menu',
  'csp-provider',
  'dialog',
  'direction-provider',
  'drawer',
  'field',
  'fieldset',
  'form',
  'input',
  'menu',
  'menubar',
  'meter',
  'navigation-menu',
  'number-field',
  'otp-field',
  'popover',
  'preview-card',
  'progress',
  'radio',
  'radio-group',
  'scroll-area',
  'select',
  'separator',
  'slider',
  'switch',
  'tabs',
  'toast',
  'toggle',
  'toggle-group',
  'toolbar',
  'tooltip',
  'unstable-use-media-query',
  'use-render',
] as const;

export type ComponentName = (typeof COMPONENTS)[number];

/** Export subpaths that are not components, each with the reason it has no scenario. */
export const NON_COMPONENT_EXPORTS: Record<string, string> = {
  '.': 'barrel re-exporting the component subpaths',
  './merge-props': 'pure props utility; it runs inside every scenario that composes props',
  './types': 'type-only module',
  './utils': 're-exports of shared helpers, not a rendered part',
  './internals/*': 'private building blocks; measured through the components that use them',
};

/** Components still without a scenario, each naming the leaf that adds it. Must stay disjoint from covered ones. */
export const PENDING_COVERAGE: Partial<Record<ComponentName, string>> = {
  fieldset: 'plan 3 leaf 1.13 adds the Fieldset scenario',
  'unstable-use-media-query': 'plan 3 leaf 1.13 adds the useMediaQuery scenario',
};

/**
 * Coverage dimensions, the same axes as the per-component matrix (plan 3 leaf 1.13).
 *
 * - `scale-1`, `scale-100`, `scale-1000`: instance or item count, bucketed by order of magnitude
 *   (up to 30, 31 to 600, above 600).
 * - `controlled`, `uncontrolled`: who owns the state the steps change.
 * - `static-props`, `reactive-props`: whether the steps write props the parts read.
 * - `wrapper`: parts rendered through a `{...props}` user component.
 * - `render-fn`, `render-element`: the `render` prop as a function or an element/tag.
 * - `open`, `close`, `toggle-all`: disclosure and popup transitions, one or all at once.
 * - `keyboard`, `pointer`, `typing`: the input the steps dispatch.
 * - `animated`: the fixture runs CSS transitions.
 * - `portal`: parts mount through a portal.
 * - `nested`: nested roots (submenus, nested dialogs, stacked portals).
 * - `raw`: the hand-written floor that mirrors a component's DOM, not the component itself.
 * - `ssr`, `hydrate`: server render and hydration fixtures.
 */
export const SCENARIO_TAGS = [
  'scale-1',
  'scale-100',
  'scale-1000',
  'controlled',
  'uncontrolled',
  'static-props',
  'reactive-props',
  'wrapper',
  'render-fn',
  'render-element',
  'open',
  'close',
  'toggle-all',
  'keyboard',
  'pointer',
  'typing',
  'animated',
  'portal',
  'nested',
  'raw',
  'ssr',
  'hydrate',
] as const;

export type ScenarioTag = (typeof SCENARIO_TAGS)[number];

const closedRoot = (name: string) =>
  `closed popup root cost > a closed ${name} root stays within its node budget`;
const BUTTON_NATIVE =
  'native part cost > a native Button with literal props costs only the dev component root beyond its element';
const BUTTON_REACTIVE =
  'native part cost > a native Button costs at most 2 reactive nodes with reactive children and props';
const GROUPED_TOGGLE =
  'native toggles cost > Toggle in a ToggleGroup: ≤ 5 nodes beyond a hand-written grouped toggle';
const RADIO =
  'native toggles cost > Radio.Root + Indicator in a RadioGroup: ≤ 18 nodes beyond a hand-written radio';

/**
 * The `*.cost.test.tsx` tests each component owns, by full name (`describe > it`, as `vitest list`
 * prints it). `bench:component` runs exactly these; the manifest test checks every name exists.
 */
export const COST_TESTS: Partial<Record<ComponentName, readonly string[]>> = {
  accordion: [
    'native disclosure part cost > a closed Accordion item (Item + Header + Trigger + Panel) costs at most 14 nodes (dev)',
  ],
  'alert-dialog': [closedRoot('AlertDialog')],
  button: [
    BUTTON_NATIVE,
    BUTTON_REACTIVE,
    'render core cost > Button costs at most 3 reactive nodes',
  ],
  checkbox: [
    'native toggles cost > Checkbox.Root + Indicator: ≤ 19 nodes beyond a hand-written checkbox',
    'render core cost > Checkbox.Root costs at most 10 reactive nodes',
  ],
  collapsible: [
    'native disclosure part cost > a closed Collapsible (Root + Trigger + Panel) costs at most 12 nodes (dev)',
    'native disclosure part cost > an open Collapsible (Root + Trigger + rendered Panel) costs at most 18 nodes (dev)',
  ],
  combobox: [closedRoot('Combobox')],
  'context-menu': [closedRoot('ContextMenu')],
  dialog: [closedRoot('Dialog')],
  drawer: [closedRoot('Drawer')],
  menu: [closedRoot('Menu')],
  'navigation-menu': [closedRoot('NavigationMenu')],
  popover: [closedRoot('Popover')],
  'preview-card': [closedRoot('PreviewCard')],
  radio: [RADIO],
  'radio-group': [RADIO],
  select: [closedRoot('Select'), 'render core cost > Select.Item costs at most 27 reactive nodes'],
  switch: ['native toggles cost > Switch.Root + Thumb: ≤ 10 nodes beyond a hand-written switch'],
  tabs: [
    'native disclosure part cost > a Tab and its hidden Panel cost at most 4 nodes together (dev)',
  ],
  toggle: [
    'native toggles cost > Toggle: ≤ 5 nodes beyond a hand-written toggle button',
    GROUPED_TOGGLE,
  ],
  'toggle-group': [GROUPED_TOGGLE],
  tooltip: [closedRoot('Tooltip')],
};

/** Components with no cost test yet, each naming the plan 3 leaf that adds its budget. */
export const PENDING_COST: Partial<Record<ComponentName, string>> = {
  autocomplete: '8.1 composite lists family',
  avatar: '1.13 cost tests for the slowest static mounts',
  'checkbox-group': '5.1 toggles family',
  'csp-provider': '4.1 static parts family',
  'direction-provider': '4.1 static parts family',
  field: '6.1 forms family',
  fieldset: '6.1 forms family',
  form: '6.1 forms family',
  input: '4.1 static parts family',
  menubar: '8.1 composite lists family',
  meter: '1.13 cost tests for the slowest static mounts',
  'number-field': '6.1 forms family',
  'otp-field': '6.1 forms family',
  progress: '1.13 cost tests for the slowest static mounts',
  'scroll-area': '7.1 Tabs and ScrollArea family',
  separator: '1.13 cost tests for the slowest static mounts',
  slider: '6.1 forms family',
  toast: '10.1 toast family',
  toolbar: '5.1 toggles family',
  'unstable-use-media-query': '4.1 static parts family',
  'use-render': '1.13 cost tests for the slowest static mounts',
};

/** Cost tests that guard the render core rather than one component, each with its reason. */
export const GENERIC_COST_TESTS: Record<string, string> = {
  'render core cost > static attributes create no reactive nodes':
    'useRenderElement: static attributes stay out of the reactive graph for every part',
  'native part cost > static attributes and handlers create no reactive nodes':
    'native kit: static attributes and handlers stay out of the reactive graph for every part',
  'native part cost > every reactive input shares one attribute effect':
    'native kit: reactive inputs share one grouped attribute effect for every part',
};
