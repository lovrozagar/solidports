import { createMultipleTypes } from 'docs/src/utils/createTypes';
import { DocsProviders } from 'docs/src/components/DocsProviders';
import fixture from '../__fixtures__/types.json';

// `Accordion.Root`'s API table as the docs build it from docs-infra's precomputed types.
const { types } = createMultipleTypes(
  'file:///docs/src/app/(docs)/solid/components/accordion/types.ts',
  // The precomputed exports name the parts; the components themselves are not needed.
  { Root: null },
  fixture as never,
);

/** The table as a docs page renders it. */
export function TypesFixture() {
  return (
    <DocsProviders>
      <types.Root />
    </DocsProviders>
  );
}

/** The table alone: no provider collects its types, so nothing changes it once mounted. */
export function BareTypesFixture() {
  return <types.Root />;
}
