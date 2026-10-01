# SolidPorts

1:1 Solid ports of React libraries. Same public API, Solid reactivity underneath.

This repo is the source of [`@solidports/base-ui`](https://www.npmjs.com/package/@solidports/base-ui), [`@solidports/recharts`](https://www.npmjs.com/package/@solidports/recharts), and [`@solidports/flare-ui`](packages/flare-ui).

If you are an agent: read this file end to end. Import only from the package exports. Work in `packages/base-ui/packages/solid`, `packages/recharts`, `packages/flare-ui`, or `packages/flare-ui-consumer` unless the request says otherwise.

## Table of contents

- [Packages](#packages)
- [Install](#install)
- [Base UI](#base-ui)
- [Recharts](#recharts)
- [Flare UI](#flare-ui)
- [Repository layout](#repository-layout)
- [Develop](#develop)
- [License](#license)

## Packages

| Package                                                  | Upstream                                                | Status                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| [`@solidports/base-ui`](packages/base-ui/packages/solid) | [MUI Base UI](https://github.com/mui/base-ui) v1.8.0    | Solid port of the headless component library. Docs at `packages/base-ui/docs/solid`.        |
| [`@solidports/recharts`](packages/recharts)              | [recharts](https://github.com/recharts/recharts) v3.8.1 | Solid port of the charting library. Test parity was 28% (1224 / 4338) at the last snapshot. |
| [`@solidports/flare-ui`](packages/flare-ui)              | Flare UI snapshot `b622cc453`                           | ShadCN-shaped Solid components wrapping `@solidports/base-ui` 1.8.0-sp.1.                   |

Both trees last lived in the private monorepo and were removed on 19 Aug 2026. This repo restores the 18 Aug 2026 snapshot (`b622cc453`) and continues the ports here.

## Install

Consumers need Solid 1.9. This repo develops on [Bun](https://bun.sh) 1.3+.

```bash
bun add @solidports/base-ui solid-js
bun add @solidports/recharts solid-js
bun add @solidports/flare-ui solid-js @solidports/base-ui tailwindcss
```

```bash
npm install @solidports/base-ui solid-js
npm install @solidports/recharts solid-js
npm install @solidports/flare-ui solid-js @solidports/base-ui tailwindcss
```

```bash
pnpm add @solidports/base-ui solid-js
pnpm add @solidports/recharts solid-js
pnpm add @solidports/flare-ui solid-js @solidports/base-ui tailwindcss
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

Drop-in Solid charting. Public API tracks recharts v3.8.1.

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

## Flare UI

ShadCN-shaped Solid components wrapping `@solidports/base-ui`. The design-system gallery lives in [`packages/flare-ui-consumer`](packages/flare-ui-consumer): all 42 components on one page, with Dark and RTL switches.

```bash
bun run dev:flare-ui
```

Open [http://localhost:4100](http://localhost:4100). Playwright still uses the isolated fixture on port 4099.

## Repository layout

```
packages/base-ui/                 MUI Base UI fork (React reference + Solid port + docs)
packages/base-ui/packages/solid   published `@solidports/base-ui`
packages/base-ui/packages/react   upstream React reference (v1.8.0)
packages/base-ui/docs/react       upstream docs snapshot
packages/base-ui/docs/solid       Solid docs app
packages/recharts/                published `@solidports/recharts`
packages/recharts/examples/       basic / react / shadcn / visual harnesses
packages/flare-ui/                published `@solidports/flare-ui`
packages/flare-ui-consumer/       private gallery — all 42 components, Dark + RTL, port 4100
```

Porting notes live in each package's `.kb/`.

## Develop

Requires [Bun](https://bun.sh) 1.3+ and TypeScript 7.

```bash
bun install
bun run typecheck
bun run test                 # @solidports/recharts unit
bun run test:base-ui         # @solidports/base-ui jsdom
bun run test:flare-ui        # @solidports/flare-ui Playwright chromium-ltr
bun run dev:flare-ui         # gallery at http://localhost:4100
bun run lint
bun run fmt:check
```

Package-local:

```bash
bun run --filter @solidports/recharts test
bun run --filter @solidports/recharts typecheck
bun run --filter @base-ui/monorepo test:solid:jsdom
```

GitHub Actions (`.github/workflows/ci.yml`) runs install, fmt, lint, and typecheck.

Do not weaken `strict` or add `as any` to make typecheck pass.

## License

MIT. Copyright (c) 2026 Lovro Žagar.

`@solidports/base-ui` also carries the MUI Base UI MIT license (Copyright (c) 2019 Material-UI SAS). `@solidports/recharts` also carries the recharts MIT license (Copyright (c) 2015-present recharts). See each package `LICENSE` / `NOTICE`.
