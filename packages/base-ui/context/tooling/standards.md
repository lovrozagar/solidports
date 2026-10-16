---
tags: [standards, gates, hooks, tdd]
sources: [scripts/verify.ts, scripts/pre-push.ts, scripts/standards-check.ts, lefthook.yml, lefthook.base.yml, oxlint.base.json, .oxlintrc.json, .oxfmtrc.jsonc, package.json]
verified: 2026-10-17
---

# Standards

`~/Development/standards` owns the shared tooling of this repo: managed files, the gate scripts, the verify stamp and the lefthook hooks. Base UI work goes through the same gates, but root oxlint and oxfmt skip `packages/base-ui/**`.

The rules themselves live in `.claude/rules/standards.md` (TDD, gates, managed files), `.rulesync/reference/gates.md` (script contract, where each gate runs, the stamp, sync) and `.rulesync/reference/tdd.md` (red, fix, green). This file maps them onto the repo.

## What standards manages here

| Kind | Files |
| :--- | :--- |
| "Managed by ~/Development/standards" header | `scripts/verify.ts`, `scripts/pre-push.ts`, `scripts/standards-check.ts`, `lefthook.base.yml`, `.rulesync/reference/gates.md`, `.rulesync/reference/tdd.md`, `.rulesync/rules/standards.md` and its generated copies (`.claude/rules/`, `.agents/rules/`, `.grok/rules/`) |
| `*.base.*` configs | `oxlint.base.json`, `lefthook.base.yml` |
| Whole file | `.oxfmtrc.jsonc` (now `semi: false`) |
| `package.json` keys | the `scripts`, `devDependencies` and `standards` entries sync sets; `standards` is `{ repo: "solidports", gates: ["test:scripts", "test:solid-table"] }` |

Repo-owned: `lefthook.yml` (extends `lefthook.base.yml` and adds the `base-ui-eslint` pre-commit job), `.oxlintrc.json`, and the root `lint/` plugin (planned, see [lint and format](lint-and-format.md)). Base UI's ESLint, Prettier, stylelint, Vale and markdownlint configs are upstream's and outside standards.

## Gates

`bun run verify` (`scripts/verify.ts`) refuses a dirty tree, then runs in order, stopping at the first failure:

1. `fmt:check`: `oxfmt --check`
2. `lint`: `oxlint --config .oxlintrc.json scripts`
3. `typecheck`: `type:check` of `@solidports/base-ui`, `@solidports/recharts`, `@solidports/solid-table`
4. `test`: the `@solidports/recharts` suite
5. `test:scripts`: `bun test ./scripts` (includes the context map check)
6. `test:solid-table`

On success it writes `standards-verified/<sha>` in the common git dir (shared by worktrees, never committed).

None of these run Base UI's tests or its ESLint. For Base UI changes, run `bun run test:base-ui:all` as the root `AGENTS.md` says, and report passed, failed and not run.

## Hooks (lefthook)

- pre-commit, on staged files: `oxlint --fix` and `oxfmt` (restaged), then `oxfmt --check`, `oxlint`, and the full `bun run typecheck`. This repo adds `base-ui-eslint`: Base UI's ESLint on the staged `packages/base-ui/{packages,docs}/solid` files, which the oxlint jobs skip.
- commit-msg: commitlint (Conventional Commits, `.commitlintrc.json`).
- pre-push: `fmt:check` and `lint` on the whole tree, `scripts/standards-check.ts`, then `scripts/pre-push.ts`, which refuses any pushed commit without a verify stamp.

`prepare` runs `lefthook install --reset-hooks-path`. Never bypass the hooks or stamp by hand (see `.claude/rules/standards.md`).

## TDD

Every change starts with a test that fails for the reason it names; lint rules start with a failing RuleTester case in the repo's `lint/` plugin. For Base UI that means a failing Vitest case under `packages/solid` (or `react-to-solid.test.mjs` / a docs-infra runtime test for docs). See [port a component](../workflows/port-a-component.md) and [fix a failing test](../workflows/fix-a-failing-test.md).

## Change a managed file

1. Edit it in `~/Development/standards` (the header names the source path, such as `files/scripts/verify.ts`).
2. Run `bun sync.ts --only solidports` there on a clean solidports tree. Sync writes the files, installs, regenerates rulesync output, commits `chore: sync grunt <v> + standards <sha>` and runs verify.
3. An edit made here instead fails pre-push's drift check on any machine that has the standards repo.

`~/Development/standards` is absent on this Mac, so `standards-check.ts` prints "drift check skipped" and passes. The synced files are committed, so CI still runs what was last synced; nothing local catches an edit to a managed file. Make such a change on the machine that has the standards repo, or ask the user.
