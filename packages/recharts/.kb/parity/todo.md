# Parity TODO — upstream symbols not yet ported

Generated: 2026-04-26T13:13:18.518Z

Each entry is intentionally deferred — surface to the audit allowlist (`scripts/parity-audit.ts::UPSTREAM_DEFERRED`) so it doesn't fail CI, and tracked here with rationale and target phase.

## Deferred exports

### `createHorizontalChart` (value)

- **Rationale**: Typed-chart factory utility; deferred — see .upstream/map.json::unported_upstream.
- **Upstream source**: `./util/createCartesianCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `createVerticalChart` (value)

- **Rationale**: Typed-chart factory utility; deferred — see .upstream/map.json::unported_upstream.
- **Upstream source**: `./util/createCartesianCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `createCentricChart` (value)

- **Rationale**: Typed-polar factory utility; deferred — see .upstream/map.json::unported_upstream.
- **Upstream source**: `./util/createPolarCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `createRadialChart` (value)

- **Rationale**: Typed-polar factory utility; deferred — see .upstream/map.json::unported_upstream.
- **Upstream source**: `./util/createPolarCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `TypedHorizontalChartContext` (type)

- **Rationale**: Companion type for createHorizontalChart; deferred.
- **Upstream source**: `./util/createCartesianCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `TypedVerticalChartContext` (type)

- **Rationale**: Companion type for createVerticalChart; deferred.
- **Upstream source**: `./util/createCartesianCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `NoFunnel` (type)

- **Rationale**: Companion type for cartesian factories; deferred.
- **Upstream source**: `./util/createCartesianCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `TypedCentricChartContext` (type)

- **Rationale**: Companion type for createCentricChart; deferred.
- **Upstream source**: `./util/createPolarCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `TypedRadialChartContext` (type)

- **Rationale**: Companion type for createRadialChart; deferred.
- **Upstream source**: `./util/createPolarCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `NoRadial` (type)

- **Rationale**: Companion type for polar factories; deferred.
- **Upstream source**: `./util/createPolarCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

### `NoCentric` (type)

- **Rationale**: Companion type for polar factories; deferred.
- **Upstream source**: `./util/createPolarCharts`
- **Target phase**: post-Phase-6 (consumer-app validation first).

