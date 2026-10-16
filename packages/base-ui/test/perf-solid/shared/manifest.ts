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
