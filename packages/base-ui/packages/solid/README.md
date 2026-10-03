<!-- markdownlint-disable MD041 -->

# @solidports/base-ui

A Solid port of [MUI Base UI](https://github.com/mui/base-ui): headless, accessible components and
low-level hooks for [Solid 2](https://github.com/solidjs/solid). It tracks `@base-ui/react` 1.8.0
and ports its behavior and test suite one to one.

> Prerelease. Solid 2 is a release candidate, and so is this package.

## Installation

```bash
npm install @solidports/base-ui@next solid-js @solidjs/web @floating-ui/dom @floating-ui/utils
```

The package has no dependencies of its own; everything it imports is a peer dependency, so your
app controls every version.

Requirements:

- `solid-js` and `@solidjs/web` 2.0 RC (`~2.0.0-rc.13`).
- `@floating-ui/dom` (`^1.8.0`) and `@floating-ui/utils` (`^0.2.11`) for positioning.
- A Solid compiler in your build, such as Vite with `@solidjs/vite-plugin`. The package ships its
  TypeScript and JSX source (ESM only) so your build compiles it for the DOM, SSR, or hydration
  target you use. Type declarations are prebuilt.
- Optional: `date-fns` and `@date-fns/tz`, or `luxon`, only for the temporal adapters under
  `@solidports/base-ui/internals/*`.

## Usage

```tsx
import { Popover } from '@solidports/base-ui/popover';

export function Example() {
  return (
    <Popover.Root>
      <Popover.Trigger>Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Popover.Popup>Content</Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
```

Each component has its own entry point (`@solidports/base-ui/<component>`), and the root entry
re-exports all of them.

## Versioning

Versions follow upstream Base UI. Prereleases add a counter (`1.8.0-1`, `1.8.0-2`, …) and are
published under the `next` tag. The stable port of a Base UI release uses the bare upstream version
(`1.8.0`) under `latest`.

## Content Security Policy

Components that need global styles (for example, the scrollbar rule used by `ScrollArea`) add a
`<style>` element to `<head>`. Under a nonce-based `style-src`, provide the nonce in one of these
ways:

- Wrap your app in `CSPProvider` from `@solidports/base-ui/csp-provider` and pass `nonce`.
- Render `<meta name="csp-nonce" content="…">` (or `property="csp-nonce"`) in the document head.
  Server-rendered styles use the render's nonce.

## Documentation

The API matches Base UI. Use the [Base UI documentation](https://base-ui.com/react/overview/quick-start)
for component anatomy and props. The Solid docs app lives in
[`packages/base-ui/docs/solid`](https://github.com/lovrozagar/solidports/tree/main/packages/base-ui/docs/solid).

## Credits

Base UI is built by the MUI team. Consider supporting them on
[Open Collective](https://opencollective.com/mui-org). The original Solid port was started by
[@msviderok](https://github.com/msviderok/base-ui-solid).

## License

[MIT](./LICENSE)
