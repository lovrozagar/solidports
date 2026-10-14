// Started with every process that runs docs-infra (`NODE_OPTIONS=--import=./framework/typescript.mjs`
// in the docs scripts), so its type workers start with it too.
//
// docs-infra depends on `typescript` as `@typescript/typescript6`, while typescript-api-extractor,
// which reads the programs docs-infra creates, gets the workspace's TypeScript. Two versions number
// their syntax kinds differently and the extraction fails. docs-infra imports the workspace's
// TypeScript here, so both read the same one.
import { createRequire, registerHooks } from 'node:module';
import { pathToFileURL } from 'node:url';

const typescript = pathToFileURL(
  createRequire(`${process.cwd()}/package.json`).resolve('typescript'),
).href;

// `--import` runs this module again in each worker thread, which registers the hook there too.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'typescript' && context.parentURL?.includes('/@mui/internal-docs-infra/')) {
      return { url: typescript, format: 'commonjs', shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});
