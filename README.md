# SolidPorts

1:1 Solid ports of React libraries. Same public API, Solid reactivity underneath.

This repo is the source of [`@solidports/base-ui`](https://www.npmjs.com/package/@solidports/base-ui), [`@solidports/recharts`](https://www.npmjs.com/package/@solidports/recharts), and [`@solidports/solid-table`](https://www.npmjs.com/package/@solidports/solid-table).

If you are an agent: read this file end to end. Import only from the package exports. Work in `packages/base-ui/packages/solid`, `packages/recharts`, or `packages/solid-table` unless the request says otherwise.

## Table of contents

- [Packages](#packages)
- [Install](#install)
- [Base UI](#base-ui)
- [Recharts](#recharts)
- [Solid Table](#solid-table)
- [Repository layout](#repository-layout)
- [Develop](#develop)
- [License](#license)

## Packages

| Package                                                  | Upstream                                                 | Status                                                                                            |
| -------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`@solidports/base-ui`](packages/base-ui/packages/solid) | [MUI Base UI](https://github.com/mui/base-ui) v1.8.0     | Solid port of the headless component library. Docs at `packages/base-ui/docs/solid`.              |
| [`@solidports/recharts`](packages/recharts)              | [recharts](https://github.com/recharts/recharts) v3.10.1 | Solid port of the charting library. Single Solid store per chart; 6202 tests passing, 0 failing.  |
| [`@solidports/solid-table`](packages/solid-table)        | [TanStack Table](https://github.com/TanStack/table) v9   | Solid 2 adapter for `@tanstack/table-core`: signal-backed state, `FlexRender`, `createTableHook`. |

Both trees last lived in the private monorepo and were removed on 19 Aug 2026. This repo restores the 18 Aug 2026 snapshot (`b622cc453`) and continues the ports here.

## Install

Consumers need Solid 2.0 (`solid-js` and `@solidjs/web`). This repo develops on [Bun](https://bun.sh) 1.3+.

```bash
bun add @solidports/base-ui solid-js @solidjs/web
bun add @solidports/recharts solid-js @solidjs/web
bun add @solidports/solid-table @tanstack/table-core solid-js @solidjs/web
```

```bash
npm install @solidports/base-ui solid-js @solidjs/web
npm install @solidports/recharts solid-js @solidjs/web
npm install @solidports/solid-table @tanstack/table-core solid-js @solidjs/web
```

```bash
pnpm add @solidports/base-ui solid-js @solidjs/web
pnpm add @solidports/recharts solid-js @solidjs/web
pnpm add @solidports/solid-table @tanstack/table-core solid-js @solidjs/web
```

## Base UI

Headless, unstyled Solid components. Public API tracks `@base-ui/react@1.8.0`.

```tsx
import { Dialog } from "@solidports/base-ui/dialog";

export function Example() {
	return (
		<Dialog.Root>
			<Dialog.Trigger>Open</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Backdrop />
				<Dialog.Popup>
					<Dialog.Title>Title</Dialog.Title>
					<Dialog.Close>Close</Dialog.Close>
				</Dialog.Popup>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
```

The Solid package lives at `packages/base-ui/packages/solid`. The surrounding `packages/base-ui` tree is the MUI Base UI fork: `packages/react` is the upstream reference, `packages/utils` is shared, `docs/react` is the docs snapshot, `docs/solid` is the Solid docs app.

Please support the Base UI team on [OpenCollective](https://opencollective.com/mui-org).

## Recharts

Drop-in Solid charting. Public API tracks recharts v3.10.1.

```tsx
import { LineChart, XAxis, Line } from "@solidports/recharts";

const data = [
	{ name: "Jan", uv: 400 },
	{ name: "Feb", uv: 300 },
	{ name: "Mar", uv: 600 },
];

export function MyChart() {
	return (
		<LineChart width={500} height={300} data={data}>
			<XAxis dataKey="name" />
			<Line type="monotone" dataKey="uv" stroke="#8884d8" />
		</LineChart>
	);
}
```

Divergences from upstream:

- ESM-only.
- `className` is accepted and mapped to `class` at native SVG/HTML boundaries.
- No `React.cloneElement`. Tooltip `content` is a render prop.
- Animation is a Solid port of react-smooth internals.

A Vite + Solid harness covering public chart types lives in [`packages/recharts/examples/basic`](packages/recharts/examples/basic).

```bash
cd packages/recharts/examples/basic
bun run dev
```

## Solid Table

The TanStack Table v9 adapter for Solid 2: table state lives in Solid signals and memos, so a
component re-renders only the cells whose data it reads. Construction writes no signal, so a
server-rendered table hydrates in place.

```tsx
import { createTable, FlexRender, stockFeatures } from "@solidports/solid-table";

const table = createTable({ columns, data, features: stockFeatures });
// <FlexRender header={header} /> and <FlexRender cell={cell} /> render the column templates.
```

`createTableHook` binds features and app components once (`createAppTable`, `AppHeader`,
`AppCell`). Upstream examples run in [`packages/solid-table/examples/upstream`](packages/solid-table/examples/upstream).

## Repository layout

```
packages/base-ui/                 MUI Base UI fork (React reference + Solid port + docs)
packages/base-ui/packages/solid   published `@solidports/base-ui`
packages/base-ui/packages/react   upstream React reference (v1.8.0)
packages/base-ui/docs/react       upstream docs snapshot
packages/base-ui/docs/solid       Solid docs app
packages/recharts/                published `@solidports/recharts`
packages/recharts/examples/       basic / react / shadcn / visual harnesses
packages/solid-table/             published `@solidports/solid-table`
```

Porting notes live in each package's `.kb/`.

## Develop

Requires [Bun](https://bun.sh) 1.3+ and TypeScript 7.

```bash
bun install
bun run typecheck
bun run test                 # @solidports/recharts unit
bun run test:base-ui         # @solidports/base-ui jsdom
bun run test:solid-table     # @solidports/solid-table unit, server and hydration
bun run lint
bun run fmt:check
```

Package-local:

```bash
bun run --filter @solidports/recharts test
bun run --filter @solidports/recharts typecheck
bun run --filter @base-ui/monorepo test:solid:jsdom
```

GitHub Actions (`.github/workflows/ci.yml`) runs install, fmt, lint, typecheck, the release-script tests and the solid-table tests.

Do not weaken `strict` or add `as any` to make typecheck pass.

## Release

CI publishes. Bump the package's `package.json` version, commit, then push a tag that names the package:

| Package                   | Tag                      |
| ------------------------- | ------------------------ |
| `@solidports/base-ui`     | `base-ui-v<version>`     |
| `@solidports/recharts`    | `recharts-v<version>`    |
| `@solidports/solid-table` | `solid-table-v<version>` |

```bash
git tag solid-table-v0.1.2 && git push origin solid-table-v0.1.2
```

`.github/workflows/release.yml` resolves the package from the tag (`scripts/release-target.ts`; prefixes in `scripts/packages.ts`), fails if the version isn't the one in `package.json`, runs that package's tests, packs it with `bun pm pack` (its `prepack` builds it; `catalog:` specs resolve) and publishes to npm with provenance through Trusted Publishing, then creates the GitHub release. Prereleases (`1.8.0-9`) go to the `next` dist-tag. To retry an existing tag, run the workflow by hand with that tag.

Each package's npm settings need one Trusted Publisher: GitHub Actions, `lovrozagar` / `solidports`, workflow `release.yml`, no environment.

## License

MIT. Copyright (c) 2026 Lovro Žagar.

`@solidports/base-ui` also carries the MUI Base UI MIT license (Copyright (c) 2019 Material-UI SAS). `@solidports/recharts` also carries the recharts MIT license (Copyright (c) 2015-present recharts). See each package `LICENSE` / `NOTICE`.
