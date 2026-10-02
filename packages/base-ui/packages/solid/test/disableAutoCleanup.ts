// @solidjs/testing-library registers its own `afterEach(cleanup)` on import, before
// `setupSolid.ts` can guard teardown; `setupSolid.ts` runs cleanup itself.
process.env.STL_SKIP_AUTO_CLEANUP = 'true';
