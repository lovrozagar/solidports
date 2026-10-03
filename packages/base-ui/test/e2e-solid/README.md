# end-to-end testing (Solid)

The Solid counterpart of [`../e2e`](../e2e): the same fixtures, rendered with `@solidports/base-ui`,
served at the same URLs. The Playwright specs in [`../e2e/index.test.ts`](../e2e/index.test.ts) drive
the page through the browser only, so they run against this app unchanged.

```bash
bun run test:e2e:solid        # build, serve on :5173, run the upstream specs
bun run test:e2e:solid:dev    # dev server on :5173
```
