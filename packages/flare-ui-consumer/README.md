# @solidports/flare-ui-consumer

Private gallery for `@solidports/flare-ui`. All 42 P1 components on one page, with Dark and RTL controls.

Playwright still uses `packages/flare-ui/tests/fixture` (one route per component, port 4099). This app is the design-system playground.

```bash
bun run --filter @solidports/flare-ui-consumer dev
```

Open [http://localhost:4100](http://localhost:4100). Sidebar links jump to `#accordion`, `#dialog`, and so on.
