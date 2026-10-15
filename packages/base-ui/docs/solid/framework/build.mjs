// `next build`: builds every environment, then exits, as Next's CLI does. docs-infra's type
// loaders keep their TypeScript worker and tsconfig watchers open for the next compilation, so
// the process would otherwise never end.
import { createBuilder } from 'vite';

const builder = await createBuilder();
await builder.buildApp();
process.exit(0);
