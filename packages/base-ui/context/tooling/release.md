---
tags: [release, npm, versioning, ci]
sources: [.github/workflows/release.yml, scripts/release-target.ts, scripts/packages.ts, packages/base-ui/packages/solid/package.json, packages/base-ui/packages/solid/tsconfig.build.json, packages/base-ui/packages/solid/scripts, packages/base-ui/packages/solid/CHANGELOG.md]
verified: 2026-10-16
---

# Release

A pushed tag `base-ui-v<version>` publishes `@solidports/base-ui` from `.github/workflows/release.yml` through npm Trusted Publishing; the version is upstream's version plus a prerelease counter, so every Base UI release goes to the `next` dist-tag.

## Versioning and tags

- Version: upstream `@base-ui/react` version + `-<counter>`. Today `packages/base-ui/packages/solid/package.json` is `1.9.0-13` and `packages/react` is `1.9.0`. The counter grows per release and restarts on an upstream bump.
- Tag: `<prefix><version>`, prefixes in `scripts/packages.ts`: `base-ui-v`, `recharts-v`, `solid-table-v`. A bare `v1.9.0-13` tag publishes nothing.
- Dist-tag: a version containing `-` goes to `next`, any other to `latest` (`release-target.ts`).
- Release commit: `chore(release): base-ui v<version>`, bumping only the package version and `bun.lock` (b9b813c9 is an example). Then push the tag.

## Workflow

1. `resolve`: checks out the tag, plus the workflow's own commit as `.release-tools`, and runs `bun .release-tools/scripts/release-target.ts <tag> $GITHUB_WORKSPACE`. Using the workflow commit's resolver lets an old tag be retried. It fails when the tag names no package or its version differs from that package's `package.json`. Outputs: `name`, `dir`, `id`, `version`, `dist_tag`, `tag`.
2. `test` (60 minutes): `fmt:check`, root `lint`, then for Base UI: `bun run types`, `tsc -p tsconfig.test.json --noEmit`, `test:package` (publint + attw `esm-only`), `test:solid:jsdom`, and Chromium `test:solid:chromium`. Test steps run after an earlier failure (`!cancelled()`) so one run reports every failure.
3. `npmjs`: skips when npm already has the version. `bun pm pack` runs `prepack` and resolves `catalog:`/`workspace:` specs (the job fails if any remain in the packed `package.json`). It exchanges the GitHub OIDC token for an npm token, then `npm publish --provenance --tag <dist_tag>`. A publish race where the version appears anyway counts as success.
4. `github-release`: `gh release create <tag> --generate-notes`, marked prerelease for `next`.

`workflow_dispatch` with `tag` republishes an existing tag. The npm Trusted Publisher must match `lovrozagar/solidports`, `release.yml`, no environment; the job prints this when the exchange fails.

## What ships

The package ships uncompiled `src` (Solid JSX; consumers compile it) plus declarations in `types/`. Each export maps `types` → `./types/...d.ts`, and both `solid` and `default` → `./src/...`.

- `prepack` = `types` = `tsc -p tsconfig.build.json && node scripts/addDeclarationExtensions.mjs`.
- `tsconfig.build.json`: `emitDeclarationOnly`, `rootDir: src`, `outDir: types`, `jsx: preserve`, `jsxImportSource: @solidjs/web`; excludes tests, specs, `*.ssr-fixtures.*` and `test-utils.*`.
- `addDeclarationExtensions.mjs` adds file extensions to relative specifiers so `node16`/`nodenext` consumers resolve the types.
- `validateBuiltTypes.mjs` (`test:built-types`) checks that every import in `types/` resolves inside `types/` or names a peer dependency.
- `files` excludes tests, specs, SSR fixtures, test utils and stray `.d.ts` from `src`.

## CHANGELOG

`packages/base-ui/packages/solid/CHANGELOG.md` is hand-written, newest first, one bold-titled bullet per user-facing change. Its newest entry is `1.8.0-10` (2026-10-05); no entry covers `1.9.0-*`. The upstream `release:changelog` scripts (`code-infra generate-changelog`) are not part of this flow.

## Gaps (b9b813c9)

- The release `test` job does not run `test:built-types`; only the "Package verification" job in `base-ui-tests.yml` and the nightly typescript@next job do.
- Firefox and WebKit do not run before publish; they run only in `base-ui-browser-parity.yml` on pushes to `main`.
- E2E, regressions, screen reader, docs validation, public-types, node-resolution and test parity do not run before publish either. `base-ui-tests.yml` has a `workflow_call` trigger and its header says the release workflow calls it, but `release.yml` does not.
- The CHANGELOG stops at `1.8.0-10`, and `packages/base-ui/README.md` still says the library matches `@base-ui/react@1.8.0`.
- `packages/base-ui/package.json` keeps upstream's `release:*` scripts (lerna, `code-infra publish`); they do not apply here.

Before tagging, run `bun run test:base-ui:all` (see [scripts](scripts.md)) and confirm the last "Base UI tests" run on `main` is green, since the release job covers less. The verify and push gates are in [standards](standards.md).
