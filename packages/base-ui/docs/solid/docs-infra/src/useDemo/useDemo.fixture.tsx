import { createDemoWithVariants } from 'docs/src/utils/createDemo';
import { DocsProviders } from 'docs/src/components/DocsProviders';
import CssModules from 'docs/src/app/(docs)/solid/components/popover/demos/hero/css-modules';
import Tailwind from 'docs/src/app/(docs)/solid/components/popover/demos/hero/tailwind';
import fixture from '../__fixtures__/demo.json';
import { createPageFixture } from '../__fixtures__/router';

// The Popover hero demo as the docs build it from docs-infra's precomputed code: a demo whose
// content changes inside it (the popup opens).
const DemoPopoverHero = createDemoWithVariants(
  'file:///docs/src/app/(docs)/solid/components/popover/demos/hero/index.ts',
  { CssModules, Tailwind },
  fixture as never,
);

/** The demo on a docs page. */
export const DemoFixture = createPageFixture('/solid/components/popover', () => (
  <DocsProviders>
    <DemoPopoverHero />
  </DocsProviders>
));
