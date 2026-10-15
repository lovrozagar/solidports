# Workflow: a docs demo (Solid)

Every page and demo in `docs/solid` is **generated** from `docs/react` by
`scripts/docs/generate.mjs`. Do not hand-edit `docs/solid`; the next
`docs:generate` overwrites it.

```bash
bun run docs:sync        # refresh docs/react from mui/base-ui@DOCS_TAG
bun run docs:generate    # write docs/solid from docs/react
bun run docs:validate    # docs-infra API tables and page indexes
bun run docs:dev
```

## When to use

- A new upstream demo: it arrives with `docs:sync`, and `docs:generate`
  ports it.
- A demo that renders wrong or fails to compile in Solid: fix the generator.

## Steps

1. **Find the React demo** under
   `docs/react/src/app/(docs)/react/components/<component>/demos/<demo>/`.
   Its Solid output is the same path under
   `docs/solid/src/app/(docs)/solid/components/`.

2. **Fix the cause in the generator.**
   - React code the transform ports wrong: add or fix a rule in
     `scripts/docs/react-to-solid.mjs`, with a case in
     `react-to-solid.test.mjs` first.
   - What Next.js or React provides that Solid lacks: an adapter in
     `scripts/docs/templates/`.
   - A library with no Solid 2 version: add the section to
     `EXCLUDED_SECTIONS` in `generate.mjs` with the reason.

3. **Regenerate and check:**

   ```bash
   bun run docs:generate
   bun run docs:validate
   bunx vitest run --project @solidports/docs --project @solidports/docs:dom
   (cd docs/solid && bun run typescript --noEmit)
   ```

4. **Verify in the browser.** Start `bun run docs:dev`, open the page next
   to the React docs (`bun run docs:react:dev`), and walk the golden path
   and obvious edge cases. Watch the console for errors.

## Done when

- [ ] The demo renders and behaves as the React one does.
- [ ] Transform tests, docs tests and the docs typecheck pass.
- [ ] `docs:validate` leaves the tree unchanged after you commit its output.
