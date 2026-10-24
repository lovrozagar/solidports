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
export const PENDING_COVERAGE: Partial<Record<ComponentName, string>> = {};

/**
 * Coverage dimensions, the same axes as the per-component matrix (plan 3 leaf 1.13).
 *
 * - `scale-1`, `scale-100`, `scale-1000`: instance or item count, bucketed by order of magnitude
 *   (up to 30, 31 to 600, above 600).
 * - `controlled`, `uncontrolled`: who owns the state the steps change.
 * - `static-props`, `reactive-props`: whether the steps write props the parts read.
 * - `wrapper`: parts rendered through a `{...props}` user component.
 * - `render-fn`, `render-element`: the `render` prop as a function or an element/tag.
 * - `render-component`: the `render` prop as a consumer component that forwards its props and
 *   ref to a tag (Solid `{ component: AppButton }`, React `render={<AppButton />}`).
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
  'render-component',
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
const bareRoot = (name: string) =>
  `closed popup root cost > a closed ${name} root alone stays within its node budget`;
const rootCollections = (name: string) =>
  `closed popup root collections > a closed ${name} root constructs at most its budget of Maps and Sets`;
const BUTTON_NATIVE =
  'native part cost > a native Button with literal props costs only the dev component root beyond its element';
const BUTTON_REACTIVE =
  'native part cost > a native Button costs at most 2 reactive nodes with reactive children and props';
/** A native static part's budget test (`utils/native/static.cost.test.tsx`). */
const staticPart = (name: string) => `native static part cost > ${name} (dev)`;
const GROUPED_TOGGLE =
  'native toggles cost > Toggle in a ToggleGroup: ≤ 5 nodes beyond a hand-written grouped toggle';
const RADIO =
  'native toggles cost > Radio.Root + Indicator in a RadioGroup: ≤ 10 nodes beyond a hand-written radio';
const RADIO_INDICATOR =
  'native toggles cost > an unchecked Radio.Indicator: ≤ 7 nodes beyond its root, its transition machinery not yet made';

/** Plan 3 leaf 5.1.2's budgets for each `render` value on a family's Trigger and Panel. */
const renderFormCosts = (family: 'accordion' | 'collapsible') =>
  ['a tag', 'a component config', 'a consumer component', 'a render function']
    .flatMap((form) =>
      [
        'a Trigger costs at most the plain Trigger plus its own element',
        'a closed Panel costs at most the plain closed Panel',
        'an open Panel costs at most the plain open Panel plus its own element',
        ...(family === 'collapsible'
          ? ['a closed', 'an open'].map(
              (open) =>
                `forwarded through a wrapper > ${open} Trigger and Panel cost at most the direct form plus the wrappers and a memo each`,
            )
          : ['a closed', 'an open'].map(
              (open) =>
                `forwarded through a wrapper > ${open} item's Trigger and Panel cost at most the direct form plus a memo each and the Header's insert`,
            )),
      ].map(
        (test) =>
          `${family} cost against the hand-written floor > with ${form} as render > ${test}`,
      ),
    )
    .concat(
      `${family} cost against the hand-written floor > a Trigger with a tag or a tag config costs exactly the plain Trigger`,
    );

/**
 * The `*.cost.test.tsx` tests each component owns, by full name (`describe > it`, as `vitest list`
 * prints it). `bench:component` runs exactly these; the manifest test checks every name exists.
 */
export const COST_TESTS: Partial<Record<ComponentName, readonly string[]>> = {
  avatar: ['render core cost > an Avatar (Root, Image, Fallback) costs at most 49 reactive nodes'],
  'otp-field': [
    'OTP field cost against the hand-written floor > the floor renders the same DOM as an OTP field',
    "OTP field cost against the hand-written floor > an OTP field's parts render on the native path",
    'OTP field cost against the hand-written floor > root costs at most its native budget',
    'OTP field cost against the hand-written floor > input costs at most its native budget',
  ],
  slider: [
    'slider cost against the hand-written floor > the floor renders the same DOM as a slider',
    "slider cost against the hand-written floor > a slider's parts render on the native path",
    'slider cost against the hand-written floor > root costs at most its native budget',
    'slider cost against the hand-written floor > label costs at most its native budget',
    'slider cost against the hand-written floor > value costs at most its native budget',
    'slider cost against the hand-written floor > control costs at most its native budget',
    'slider cost against the hand-written floor > track costs at most its native budget',
    'slider cost against the hand-written floor > indicator costs at most its native budget',
    'slider cost against the hand-written floor > thumb costs at most its native budget',
  ],
  'use-render': ['render core cost > a part built on useRender costs at most 16 reactive nodes'],
  accordion: [
    'native disclosure part cost > a closed Accordion item (Item + Header + Trigger + Panel) costs at most 14 nodes (dev)',

    'accordion cost against the hand-written floor > the floor renders the same DOM as Accordion, closed and open',
    "accordion cost against the hand-written floor > an Item costs at most the floor's plus 25%",
    "accordion cost against the hand-written floor > a Header costs at most the floor's plus 25%",
    "accordion cost against the hand-written floor > a Trigger costs at most the floor's plus 25%",
    "accordion cost against the hand-written floor > a closed Panel costs at most the floor's plus 25%",
    'accordion cost against the hand-written floor > an open item costs at most the open floor item plus 25%',
    ...renderFormCosts('accordion'),
    'accordion cost against the hand-written floor > an accordion with a closed item mounts at most the floor plus 25%',
    "accordion cost against the hand-written floor > an accordion's mount plus an item's first open costs at most the floor's plus 25%",
    "accordion cost against the hand-written floor > the floor's starting-style timeline matches Accordion's without motion",
    "accordion cost against the hand-written floor > the floor's starting-style timeline matches Accordion's with motion",
    "accordion cost against the hand-written floor > a panel's open reads its layout at most as often as the floor's, without motion",
    "accordion cost against the hand-written floor > a panel's open reads its layout at most as often as the floor's, with motion",
    "accordion cost against the hand-written floor > an item's open reads its membership at most 20 times",
    "accordion cost against the hand-written floor > an item's mount reads its membership at most 7 times",
  ],
  'alert-dialog': [closedRoot('AlertDialog'), bareRoot('AlertDialog')],
  button: [
    BUTTON_NATIVE,
    BUTTON_REACTIVE,
    'render core cost > Button costs at most 3 reactive nodes',
  ],
  checkbox: [
    'native toggles cost > Checkbox.Root + Indicator: ≤ 10 nodes beyond a hand-written checkbox',
    'native toggles cost > an unchecked Checkbox.Indicator: ≤ 7 nodes beyond its root, its transition machinery not yet made',
    'render core cost > Checkbox.Root costs at most 7 reactive nodes',
  ],
  collapsible: [
    'native disclosure part cost > a closed Collapsible (Root + Trigger + Panel) costs at most 12 nodes (dev)',
    'native disclosure part cost > an open Collapsible (Root + Trigger + rendered Panel) costs at most 18 nodes (dev)',

    'collapsible cost against the hand-written floor > the floor renders the same DOM as Collapsible, closed and open',
    'collapsible cost against the hand-written floor > Root costs at most 3 nodes: dev root, context owner, one grouped effect',
    'collapsible cost against the hand-written floor > Root with a Trigger costs at most 6 nodes: two dev roots, context owner, two grouped effects, the children insert',
    'collapsible cost against the hand-written floor > a closed Panel costs at most 2 nodes: its dev root and the conditional insert',
    'collapsible cost against the hand-written floor > Root costs at most the floor root plus 25%',
    'collapsible cost against the hand-written floor > Trigger costs at most the floor trigger plus 25%',
    'collapsible cost against the hand-written floor > a closed Panel costs at most the floor closed panel plus 25%',
    'collapsible cost against the hand-written floor > an open Collapsible costs at most the open floor plus 25%',
    ...renderFormCosts('collapsible'),
    'collapsible cost against the hand-written floor > a closed Collapsible mounts at most the floor plus 25%',
    "collapsible cost against the hand-written floor > a Collapsible's mount plus its first open costs at most the floor's plus 25%",
    "collapsible cost against the hand-written floor > the floor's starting-style timeline matches Collapsible's without motion",
    "collapsible cost against the hand-written floor > the floor's starting-style timeline matches Collapsible's with motion",
    "collapsible cost against the hand-written floor > a panel's open reads its layout at most as often as the floor's, without motion",
    "collapsible cost against the hand-written floor > a panel's open reads its layout at most as often as the floor's, with motion",
  ],
  combobox: [
    closedRoot('Combobox'),
    'render core cost > Combobox.Item costs at most 23 reactive nodes',
    'combobox cost against the hand-written floor > the floor renders the same option DOM as an open Combobox.Item',
    'combobox cost against the hand-written floor > an open Combobox.Item renders on the native path',
    'combobox cost against the hand-written floor > an open Combobox.Item costs at most the floor item plus 25%',
    'combobox chip cost > a Chip renders on the native path',
    'combobox chip cost > a Chip stays within its native budget',
    'combobox chip cost > a ChipRemove renders on the native path',
    'combobox chip cost > a ChipRemove stays within its native budget',
    'combobox row cost > a Row renders on the native path',
    'combobox row cost > a Row stays within its native budget',
    'item indicator cost > a mounted combobox indicator renders on the native path',
    'item indicator cost > a combobox indicator stays within its native budget',
  ],
  'context-menu': [closedRoot('ContextMenu')],
  dialog: [
    closedRoot('Dialog'),
    bareRoot('Dialog'),
    rootCollections('Dialog'),
    'dialog cost against the hand-written floor > the floor renders the same DOM as a closed Dialog.Trigger',
    'dialog cost against the hand-written floor > a closed Dialog.Trigger renders on the native path',
    'dialog cost against the hand-written floor > a closed Dialog.Trigger costs at most the native trigger budget',
    'detached-handle Dialog.Trigger cost > renders on the slow path',
    'detached-handle Dialog.Trigger cost > costs at most base at mount and after the first press, as a whole tree',
  ],
  drawer: [closedRoot('Drawer'), bareRoot('Drawer')],
  field: [
    'field cost against the hand-written floor > the floor renders the same DOM as a field in a fieldset in a form',
    "field cost against the hand-written floor > a field's parts render on the native path",
    'field cost against the hand-written floor > fieldRoot costs at most its native budget',
    'field cost against the hand-written floor > label costs at most its native budget',
    'field cost against the hand-written floor > control costs at most its native budget',
    'field cost against the hand-written floor > description costs at most its native budget',
    'field cost against the hand-written floor > error costs at most its native budget',
    'field item cost > a Field.Item renders on the native path',
    'field item cost > a Field.Item stays within its native budget',
  ],
  fieldset: [
    'field cost against the hand-written floor > fieldsetRoot costs at most its native budget',
    'field cost against the hand-written floor > legend costs at most its native budget',
  ],
  form: ['field cost against the hand-written floor > form costs at most its native budget'],
  menu: [
    closedRoot('Menu'),
    'menu cost against the hand-written floor > the floor renders the same item DOM as an open Menu.Item',
    'menu cost against the hand-written floor > an open Menu.Item renders on the native path',
    'menu cost against the hand-written floor > an open Menu.Item costs at most the floor item plus 25%',
    'menu item kinds against the hand-written floor > the floor renders the same checkbox item DOM',
    'menu item kinds against the hand-written floor > a checkbox item and any indicator render on the native path',
    'menu item kinds against the hand-written floor > a checkbox item with any indicator stays within its native budget',
    'menu item kinds against the hand-written floor > the floor renders the same radio item DOM',
    'menu item kinds against the hand-written floor > a radio item and any indicator render on the native path',
    'menu item kinds against the hand-written floor > a radio item with any indicator stays within its native budget',
    'menu item kinds against the hand-written floor > the floor renders the same link item DOM',
    'menu item kinds against the hand-written floor > a link item and any indicator render on the native path',
    'menu item kinds against the hand-written floor > a link item with any indicator stays within its native budget',
    'menu item kinds against the hand-written floor > the floor renders the same submenu item DOM',
    'menu item kinds against the hand-written floor > a submenu item and any indicator render on the native path',
    'menu item kinds against the hand-written floor > a submenu item with any indicator stays within its native budget',
  ],
  meter: [
    staticPart('a Meter.Track costs at most 1 node'),
    staticPart('a Meter.Indicator costs at most 2 nodes'),
  ],
  'navigation-menu': [
    closedRoot('NavigationMenu'),
    'navigation menu cost against the hand-written floor > the floor renders the same item DOM',
    'navigation menu cost against the hand-written floor > the floor renders the same icon DOM',
    'navigation menu cost against the hand-written floor > the floor renders the same link DOM',
    'navigation menu cost against the hand-written floor > a plain item renders on the native path',
    'navigation menu cost against the hand-written floor > a plain icon renders on the native path',
    'navigation menu cost against the hand-written floor > a plain link renders on the native path',
    'navigation menu cost against the hand-written floor > a item stays within its native budget',
    'navigation menu cost against the hand-written floor > a icon stays within its native budget',
    'navigation menu cost against the hand-written floor > a link stays within its native budget',
    'navigation menu cost against the hand-written floor > the floor renders the same trigger DOM',
    'navigation menu cost against the hand-written floor > a plain trigger renders on the native path',
    'navigation menu cost against the hand-written floor > a trigger stays within its native budget',
  ],
  'number-field': [
    'number field cost against the hand-written floor > the floor renders the same DOM as a number field',
    "number field cost against the hand-written floor > a number field's parts render on the native path",
    'number field cost against the hand-written floor > root costs at most its native budget',
    'number field cost against the hand-written floor > scrubArea costs at most its native budget',
    'number field cost against the hand-written floor > group costs at most its native budget',
    'number field cost against the hand-written floor > input costs at most its native budget',
    'number field cost against the hand-written floor > increment costs at most its native budget',
    'number field cost against the hand-written floor > decrement costs at most its native budget',
  ],
  popover: [
    closedRoot('Popover'),
    bareRoot('Popover'),
    rootCollections('Popover'),
    'popover cost against the hand-written floor > the floor renders the same DOM as a closed Popover.Trigger',
    'popover cost against the hand-written floor > a closed Popover.Trigger renders on the native path',
    'popover cost against the hand-written floor > a closed Popover.Trigger costs at most the native trigger budget',
    'detached-handle Popover.Trigger cost > renders on the slow path',
    'detached-handle Popover.Trigger cost > costs at most base at mount and after the first press, as a whole tree',
  ],
  'preview-card': [
    closedRoot('PreviewCard'),
    bareRoot('PreviewCard'),
    'preview card cost against the hand-written floor > the floor renders the same DOM as a closed PreviewCard.Trigger',
    'preview card cost against the hand-written floor > a closed PreviewCard.Trigger renders on the native path',
    'preview card cost against the hand-written floor > a closed PreviewCard.Trigger costs at most the native trigger budget',
    '<PreviewCard.Trigger /> cost > builds its inline-rect props once, whatever its card and the active trigger do',
    '<PreviewCard.Trigger /> cost > records the pointer while its card is closed and keeps it while the card is open',

    'detached-handle PreviewCard.Trigger cost > renders on the slow path',
    'detached-handle PreviewCard.Trigger cost > costs at most base at mount and after the first hover, as a whole tree',
  ],
  progress: [
    staticPart('a Progress.Track costs at most 2 nodes'),
    staticPart('a Progress.Indicator costs at most 2 nodes'),
  ],
  radio: [RADIO, RADIO_INDICATOR],
  'radio-group': [RADIO],
  select: [
    closedRoot('Select'),
    'render core cost > Select.Item costs at most 23 reactive nodes',
    'select cost against the hand-written floor > the floor renders the same option DOM as an open Select.Item',
    'select cost against the hand-written floor > an open Select.Item renders on the native path',
    'select cost against the hand-written floor > an open Select.Item costs at most the floor item plus 25%',
    'item indicator cost > a mounted select indicator renders on the native path',
    'item indicator cost > a select indicator stays within its native budget',
    'select cost against the hand-written floor > a multiple Select toggle re-runs only the toggled item',
  ],
  separator: [
    staticPart('a Separator with a literal orientation costs at most 1 node'),
    staticPart('a Separator with a reactive orientation costs at most 2 nodes'),
  ],
  switch: ['native toggles cost > Switch.Root + Thumb: ≤ 6 nodes beyond a hand-written switch'],
  tabs: [
    'native disclosure part cost > a Tab and its hidden Panel cost at most 4 nodes together (dev)',
  ],
  toggle: [
    'native toggles cost > Toggle: ≤ 5 nodes beyond a hand-written toggle button',
    GROUPED_TOGGLE,
  ],
  'toggle-group': [GROUPED_TOGGLE],
  toast: [
    'toast cost against the hand-written floor > the floor renders the same DOM as a toast',
    "toast cost against the hand-written floor > a toast's parts render on the native path",
    'toast cost against the hand-written floor > Toast root costs at most its native budget',
    'toast cost against the hand-written floor > Toast content costs at most its native budget',
    'toast cost against the hand-written floor > Toast title costs at most its native budget',
    'toast cost against the hand-written floor > Toast description costs at most its native budget',
    'toast cost against the hand-written floor > Toast close costs at most its native budget',
  ],
  tooltip: [
    closedRoot('Tooltip'),
    bareRoot('Tooltip'),
    rootCollections('Tooltip'),
    'tooltip cost against the hand-written floor > the floor renders the same DOM as a closed Tooltip.Trigger',
    'tooltip cost against the hand-written floor > a closed Tooltip.Trigger renders on the native path',
    'tooltip cost against the hand-written floor > a closed Tooltip.Trigger costs at most the native trigger budget',

    'detached-handle Tooltip.Trigger cost > renders on the slow path',
    'detached-handle Tooltip.Trigger cost > costs at most base at mount and after the first hover, as a whole tree',
  ],
};

/** Components with no cost test yet, each naming the plan 3 leaf that adds its budget. */
export const PENDING_COST: Partial<Record<ComponentName, string>> = {
  autocomplete: '8.1 composite lists family',
  'checkbox-group': '5.1 toggles family',
  'csp-provider': '4.1 static parts family',
  'direction-provider': '4.1 static parts family',
  input: '4.1 static parts family',
  menubar: '8.1 composite lists family',
  'scroll-area': '7.1 Tabs and ScrollArea family',
  toolbar: '5.1 toggles family',
  'unstable-use-media-query': '4.1 static parts family',
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
