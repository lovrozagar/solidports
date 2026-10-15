// What the Solid docs leave out of the React docs, each with its reason. Shared by the generator
// (`generate.mjs`) and the docs check (`check-hydration.mjs`).

/**
 * React docs folders the Solid docs leave out, each with its reason. Paths are under `docs/react`.
 */
export const EXCLUDED = [
  {
    path: 'src/app/(private)/experiments/',
    reason:
      'Internal React test pages rendered as React Server Components (they list and read their ' +
      'own files with node:fs at render time); Solid has no counterpart to render them with.',
  },
  {
    path: 'src/app/(private)/playground/',
    reason:
      'Internal React playground served as React Server Components (node:fs at render time); ' +
      'no counterpart in Solid.',
  },
];

/**
 * Page sections the Solid docs leave out, with their demos, each with its reason: the library the
 * section shows has no Solid 2 version. `mentions` are links to the section elsewhere on the page.
 */
export const EXCLUDED_SECTIONS = [
  {
    page: 'src/app/(docs)/react/components/combobox/page.mdx',
    heading: 'Virtualized',
    demos: 'src/app/(docs)/react/components/combobox/demos/virtualized/',
    reason:
      "@tanstack/solid-virtual targets Solid 1; the demo's virtualizer has no Solid 2 version.",
  },
  {
    page: 'src/app/(docs)/react/components/autocomplete/page.mdx',
    heading: 'Virtualized',
    demos: 'src/app/(docs)/react/components/autocomplete/demos/virtualized/',
    reason:
      "@tanstack/solid-virtual targets Solid 1; the demo's virtualizer has no Solid 2 version.",
  },
  {
    page: 'src/app/(docs)/react/handbook/forms/page.mdx',
    heading: 'React Hook Form',
    demos: 'src/app/(docs)/react/handbook/forms/demos/react-hook-form/',
    mentions: ['[React Hook Form](#react-hook-form) and ', "    'React Hook Form Integration',\n"],
    reason: 'React Hook Form has no Solid version.',
  },
  {
    page: 'src/app/(docs)/react/handbook/animation/page.mdx',
    heading: 'Animating components unmounted from DOM when closed with Motion',
    demos:
      'src/app/(docs)/react/handbook/animation/demos/animated-popover-motion-keep-mounted-false/',
    mentions: [
      'The examples below animate `opacity`, so Base UI ends the closing phase on its own.\n\n',
      "    'Motion Framer Integration',\n",
    ],
    reason: 'Motion has no Solid 2 version (its Solid bindings target Solid 1).',
  },
  {
    page: 'src/app/(docs)/react/handbook/animation/page.mdx',
    heading: 'Animating components kept in DOM when closed with Motion',
    demos:
      'src/app/(docs)/react/handbook/animation/demos/animated-popover-motion-keep-mounted-true/',
    reason: 'Motion has no Solid 2 version (its Solid bindings target Solid 1).',
  },
  {
    page: 'src/app/(docs)/react/handbook/animation/page.mdx',
    heading: 'Animating Select component with Motion',
    demos: 'src/app/(docs)/react/handbook/animation/demos/animated-select-motion/',
    reason: 'Motion has no Solid 2 version (its Solid bindings target Solid 1).',
  },
];
for (const section of EXCLUDED_SECTIONS) {
  EXCLUDED.push({ path: section.demos, reason: section.reason });
}
