# Recharts → Solid Port: Dependency Graph & Architecture Map

## Stats

| Metric      | Count |
| ----------- | ----- |
| Total files | 256   |
| Total lines | ~42K  |
| Directories | 18    |

### Lines by Directory

| Directory                                 | Files | Lines  | Port Difficulty                                |
| ----------------------------------------- | ----- | ------ | ---------------------------------------------- |
| `util/`                                   | 59    | 6,445  | Easy — mostly pure functions, minimal React    |
| `state/`                                  | 93    | 9,686  | Medium — Redux→Solid store, selectors reusable |
| `cartesian/`                              | 20    | 10,078 | Hard — heavy React patterns                    |
| `chart/`                                  | 17    | 3,919  | Medium — thin wrappers                         |
| `component/`                              | 15    | 3,510  | Hard — React.Children, cloneElement            |
| `polar/`                                  | 8     | 3,716  | Hard — same as cartesian                       |
| `shape/`                                  | 8     | 1,592  | Easy — SVG primitives                          |
| `animation/`                              | 9     | 798    | Medium — replace react-smooth                  |
| `context/`                                | 12    | 530    | Easy — React.createContext→Solid createContext |
| `synchronisation/`                        | 3     | 319    | Easy                                           |
| `zIndex/`                                 | 5     | 301    | Easy                                           |
| `container/`                              | 4     | 230    | Easy                                           |
| Root (`hooks.ts`, `types.ts`, `index.ts`) | 3     | 770    | Medium                                         |

## External Dependencies

| Package            | Usage Count    | Solid Equivalent                             |
| ------------------ | -------------- | -------------------------------------------- |
| `react`            | 188 imports    | `solid-js`                                   |
| `@reduxjs/toolkit` | 24 imports     | `solid-js/store` or custom createStore       |
| `reselect`         | 26 imports     | `createMemo` chains                          |
| `clsx`             | 38 imports     | `clsx` (framework-agnostic)                  |
| `d3-*`             | various        | `d3-*` (framework-agnostic, keep as-is)      |
| `react-smooth`     | via animation/ | Custom Solid animation or `@motionone/solid` |
| `react-is`         | few            | Remove — Solid doesn't need type checks      |

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                    index.ts                       │
│              (public API re-exports)              │
└──────────────┬───────────────────┬───────────────┘
               │                   │
    ┌──────────▼──────┐  ┌────────▼────────┐
    │   chart/*.tsx    │  │   hooks.ts       │
    │  (chart types)   │  │  (public hooks)  │
    └──────┬──────┬────┘  └────────┬────────┘
           │      │                │
    ┌──────▼──┐ ┌─▼────────┐  ┌───▼──────────┐
    │Cartesian│ │  Polar    │  │  state/       │
    │Chart    │ │  Chart    │  │  (Redux store │
    └────┬────┘ └────┬─────┘  │   + selectors)│
         │           │        └───┬───────────┘
    ┌────▼───────────▼────┐      │
    │  CategoricalChart   │◄─────┘
    │  (base chart)       │
    └────┬────────────────┘
         │
    ┌────▼────────────┐
    │ RechartsWrapper  │──► container/ (Surface, Layer, RootSurface)
    │ (sizing, events) │──► context/  (data, layout, tooltip contexts)
    └─────────────────┘──► state/RechartsStoreProvider (Redux Provider)
         │
    ┌────▼──────────────────────────────────┐
    │         Renderable Components          │
    │  cartesian/ (Line, Bar, Area, etc.)    │
    │  polar/     (Pie, Radar, RadialBar)    │
    │  component/ (Tooltip, Legend, Brush)    │
    │  shape/     (Dot, Curve, Rectangle)    │
    └───────────┬──────────────────────────┘
                │
    ┌───────────▼───────────┐
    │     util/ + zIndex/    │
    │  (pure math, D3 glue,  │
    │   SVG helpers)          │
    └────────────────────────┘
```

## Port Layers (Topological Order)

### Layer 0: Zero Dependencies (port first, copy mostly as-is)

These files have NO internal imports or only import from same directory.

```
util/round.ts
util/getSliced.ts
util/getEveryNth.ts
util/isWellBehavedNumber.ts
util/Constants.ts
util/CssPrefixUtils.ts
util/Events.ts
util/Global.ts
util/IfOverflow.ts
util/LRUCache.ts
util/LogUtils.ts
util/propsAreEqual.ts
util/createEventProxy.ts
util/excludeEventProps.ts
util/getClassNameFromUnknown.tsx
util/payload/getUniqPayload.ts
util/svgPropertiesNoEvents.ts
util/tooltip/translate.ts
util/typedDataKey.ts
util/scale/util/arithmetic.ts
util/scale/CustomScaleDefinition.ts
util/scale/index.ts
util/cursor/getCursorRectangle.ts
util/cursor/getRadialCursorPoints.ts
util/stacks/stackTypes.ts
types.ts
chart/types.ts
state/types/*.ts (all 8 files)
state/brushSlice.ts
state/chartDataSlice.ts
state/eventSettingsSlice.ts
state/layoutSlice.ts
state/legendSlice.ts
state/polarOptionsSlice.ts
state/rootPropsSlice.ts
state/zIndexSlice.ts
state/selectors/arrayEqualityCheck.ts
state/selectors/containerSelectors.ts
state/selectors/dataSelectors.ts
state/selectors/graphicalItemSelectors.ts
state/selectors/legendSelectors.ts
state/selectors/numberDomainEqualityCheck.ts
state/selectors/pickAxisId.ts
state/selectors/pickAxisType.ts
state/selectors/rootPropsSelectors.ts
state/selectors/selectAllAxes.ts
state/selectors/selectTooltipAxisId.ts
state/selectors/selectTooltipAxisType.ts
state/selectors/selectTooltipEventType.ts
state/selectors/selectTooltipPayloadSearcher.ts
state/selectors/selectTooltipSettings.ts
state/selectors/selectTooltipState.ts
state/selectors/combiners/*.ts (all 14 files)
state/reduxDevtoolsJsonStringifyReplacer.ts
synchronisation/types.ts
animation/easing.ts
animation/timeoutController.ts
animation/util.ts
zIndex/DefaultZIndexes.tsx
zIndex/getZIndexFromUnknown.tsx
```

### Layer 1: Internal-only deps (pure logic, light React removal)

```
util/types.ts → excludeEventProps, svgPropertiesNoEvents, typedDataKey, scale/CustomScaleDefinition
util/DataUtils.ts → round, types
util/svgPropertiesAndEvents.ts → excludeEventProps
util/scale/RechartsScale.ts → CustomScaleDefinition
util/scale/getNiceTickValues.ts → util/arithmetic
util/scale/createCategoricalInverse.ts → CustomScaleDefinition
util/scale/CartesianScaleHelper.ts → RechartsScale
util/stacks/getStackSeriesIdentifier.ts → stackTypes
util/cursor/getCursorPoints.ts → getRadialCursorPoints
util/PolarUtils.ts → types
util/CartesianUtils.ts → types
util/getRelativeCoordinate.ts → types
util/getRadiusAndStrokeWidthFromDot.tsx → svgPropertiesNoEvents, types
util/axisPropsAreEqual.ts → propsAreEqual, types
util/DOMUtils.ts → Global, LRUCache, types
util/ReduceCSSCalc.ts → DataUtils
util/ReactUtils.ts → DataUtils, types ← NEEDS REWRITE (React.Children etc)
util/ChartUtils.ts → DataUtils, getSliced, isWellBehavedNumber, scale/RechartsScale, stacks/stackTypes
util/getActiveCoordinate.ts → DataUtils, PolarUtils
util/getAxisTypeBasedOnLayout.ts → ChartUtils, types
util/isDomainSpecifiedByUser.ts → ChartUtils, DataUtils, isWellBehavedNumber, types
util/TickUtils.ts → CartesianUtils, getEveryNth, types
util/ScatterUtils.tsx → ActiveShapeUtils, Constants, types
util/BarUtils.tsx → ActiveShapeUtils, DataUtils, types
util/FunnelUtils.tsx → ActiveShapeUtils
util/RadialBarUtils.tsx → ActiveShapeUtils
util/ActiveShapeUtils.tsx → (standalone, but uses React)
state/cartesianAxisSlice.ts → selectors/axisSelectors
state/polarAxisSlice.ts → cartesianAxisSlice
state/referenceElementsSlice.ts → cartesianAxisSlice
state/graphicalItemsSlice.ts → cartesianAxisSlice, chartDataSlice, types/*
state/errorBarSlice.ts → graphicalItemsSlice
state/tooltipSlice.ts → cartesianAxisSlice, graphicalItemsSlice
```

### Layer 2: State Store (Redux → Solid store)

**This is the critical architectural decision.**

```
state/store.ts → all slices + all middleware
state/RechartsReduxContext.tsx → store
state/hooks.ts → RechartsReduxContext, store
state/RechartsStoreProvider.tsx → RechartsReduxContext, store
state/selectors/axisSelectors.ts → (many combiners + other selectors)
state/selectors/tooltipSelectors.ts → (many combiners + other selectors)
state/selectors/selectors.ts → (aggregator of many selectors)
state/selectors/barSelectors.ts
state/selectors/lineSelectors.ts
state/selectors/areaSelectors.ts
state/selectors/pieSelectors.ts
state/selectors/polarSelectors.ts
state/selectors/polarAxisSelectors.ts
state/selectors/polarScaleSelectors.ts
state/selectors/polarGridSelectors.ts
state/selectors/radarSelectors.ts
state/selectors/radialBarSelectors.ts
state/selectors/scatterSelectors.ts
state/selectors/funnelSelectors.ts
state/selectors/barStackSelectors.ts
state/selectors/brushSelectors.ts
state/selectors/selectChartOffsetInternal.ts
state/selectors/selectChartOffset.ts
state/selectors/selectPlotArea.ts
state/selectors/selectActivePropsFromChartPointer.ts
state/mouseEventsMiddleware.ts
state/keyboardEventsMiddleware.ts
state/touchEventsMiddleware.ts
state/externalEventsMiddleware.ts
state/Report*.tsx (5 files — dispatch props into store)
state/Set*.ts (3 files)
```

### Layer 3: Context Layer

```
context/PanoramaContext.tsx
context/brushUpdateContext.tsx
context/chartDataContext.tsx → PanoramaContext, brushUpdateContext
context/chartLayoutContext.tsx → PanoramaContext
context/legendPayloadContext.tsx
context/legendPortalContext.tsx
context/tooltipContext.tsx
context/tooltipPortalContext.tsx
context/accessibilityContext.tsx
context/ErrorBarContext.tsx → RegisterGraphicalItemId
context/RegisterGraphicalItemId.tsx
context/useTooltipAxis.ts
```

### Layer 4: Animation System

```
animation/AnimationManager.ts → configUpdate, timeoutController
animation/configUpdate.ts → easing, timeoutController, util
animation/createDefaultAnimationManager.tsx → AnimationManager, timeoutController
animation/useAnimationManager.tsx → AnimationManager, createDefaultAnimationManager
animation/CSSTransitionAnimate.tsx → AnimationManager, useAnimationManager, util
animation/JavascriptAnimate.tsx → AnimationManager, configUpdate, easing, useAnimationManager
```

### Layer 5: Shape Primitives (SVG components)

```
shape/Cross.tsx
shape/Curve.tsx
shape/Dot.tsx
shape/Polygon.tsx
shape/Rectangle.tsx
shape/Sector.tsx
shape/Symbols.tsx
shape/Trapezoid.tsx
```

### Layer 6: Container Components

```
container/Surface.tsx
container/Layer.tsx
container/RootSurface.tsx → Surface
container/ClipPathProvider.tsx
zIndex/zIndexSelectors.ts → DefaultZIndexes
zIndex/ZIndexLayer.tsx → zIndexSelectors
zIndex/ZIndexPortal.tsx → zIndexSelectors
```

### Layer 7: UI Components

```
component/Text.tsx
component/Label.tsx → Text
component/LabelList.tsx → Label, Text
component/Cell.tsx
component/DefaultLegendContent.tsx
component/Legend.tsx
component/DefaultTooltipContent.tsx
component/TooltipBoundingBox.tsx
component/Tooltip.tsx → Cursor, TooltipBoundingBox
component/Cursor.tsx
component/Dots.tsx
component/ActivePoints.tsx
component/Customized.tsx
component/ResponsiveContainer.tsx
component/responsiveContainerUtils.ts
```

### Layer 8: Cartesian Components

```
cartesian/getTicks.ts ↔ getEquidistantTicks.ts (circular — handle together)
cartesian/CartesianAxis.tsx → getTicks
cartesian/CartesianGrid.tsx → CartesianAxis, getTicks
cartesian/GraphicalItemClipPath.tsx
cartesian/XAxis.tsx → CartesianAxis
cartesian/YAxis.tsx → CartesianAxis
cartesian/ZAxis.tsx
cartesian/BarStack.tsx
cartesian/ErrorBar.tsx → Bar, Line, Scatter (circular — handle together)
cartesian/Line.tsx → ErrorBar, GraphicalItemClipPath
cartesian/Area.tsx → GraphicalItemClipPath
cartesian/Bar.tsx → BarStack, ErrorBar, GraphicalItemClipPath
cartesian/Scatter.tsx → ErrorBar, GraphicalItemClipPath
cartesian/Brush.tsx
cartesian/ReferenceLine.tsx
cartesian/ReferenceDot.tsx
cartesian/ReferenceArea.tsx
cartesian/Funnel.tsx
cartesian/getCartesianPosition.tsx
```

### Layer 9: Polar Components

```
polar/defaultPolarAngleAxisProps.tsx ↔ PolarAngleAxis.tsx (circular)
polar/defaultPolarRadiusAxisProps.tsx ↔ PolarRadiusAxis.tsx (circular)
polar/PolarGrid.tsx
polar/Pie.tsx
polar/Radar.tsx
polar/RadialBar.tsx
```

### Layer 10: Chart Wrappers (top-level, port last)

```
chart/RechartsWrapper.tsx → chart/types
chart/CategoricalChart.tsx → RechartsWrapper
chart/CartesianChart.tsx → CategoricalChart
chart/PolarChart.tsx → CategoricalChart
chart/LineChart.tsx → CartesianChart
chart/BarChart.tsx → CartesianChart
chart/AreaChart.tsx → CartesianChart
chart/ScatterChart.tsx → CartesianChart
chart/ComposedChart.tsx → CartesianChart
chart/FunnelChart.tsx → CartesianChart
chart/PieChart.tsx → PolarChart
chart/RadarChart.tsx → PolarChart
chart/RadialBarChart.tsx → PolarChart
chart/Sankey.tsx → RechartsWrapper
chart/SunburstChart.tsx → RechartsWrapper
chart/Treemap.tsx → RechartsWrapper
hooks.ts → context/, state/, synchronisation/, types, util/
synchronisation/useChartSynchronisation.tsx → syncSelectors, types
index.ts → (re-exports everything)
```

## Key Architectural Decisions for Port

### 1. Redux → Solid Store

Recharts uses **Redux Toolkit** with 15 slices, 5 middleware, and ~50 selectors (via reselect).

**Recommended approach:** Replace with `createStore` from `solid-js/store` + `createMemo` for derived state.

- Each Redux slice → a section of a Solid store
- `reselect` selectors → `createMemo` (automatic dependency tracking)
- Redux middleware (mouse/touch/keyboard events) → direct event handlers
- `useSelector` / `useDispatch` → direct store access via context

### 2. React.Children / cloneElement

Used in: `ReactUtils.ts`, `CategoricalChart`, `Legend`, `Tooltip`, `Brush`

**Recommended approach:** Solid uses `props.children` as thunks. Replace pattern-matching on children types with explicit props or Solid's `<Dynamic>` component.

### 3. forwardRef

Used extensively across shape/ and cartesian/ components.

**Recommended approach:** Solid doesn't need forwardRef — just accept `ref` as a regular prop.

### 4. Animation

`react-smooth` replaced by custom animation system in animation/ directory.

**Recommended approach:** Port AnimationManager (framework-agnostic) + replace React hooks with Solid equivalents.

### 5. Circular Dependencies

- `getTicks.ts ↔ getEquidistantTicks.ts`
- `ErrorBar.tsx → Bar/Line/Scatter` (type imports only)
- `PolarAngleAxis ↔ defaultPolarAngleAxisProps`
- `PolarRadiusAxis ↔ defaultPolarRadiusAxisProps`

Handle each pair as a single unit.

## Parallelization Strategy (5 Agents)

### Phase 1: Foundation (sequential, 1 agent)

- Port Layer 0 + Layer 1 (pure utils, types, slices)
- Design Solid store architecture to replace Redux

### Phase 2: Core Infrastructure (2-3 agents parallel)

- **Agent A:** State store + selectors (Layer 2)
- **Agent B:** Context layer + animation (Layer 3 + 4)
- **Agent C:** Shape primitives + containers (Layer 5 + 6)

### Phase 3: Components (5 agents parallel)

- **Agent 1:** cartesian/Line, cartesian/Area, cartesian/XAxis, cartesian/YAxis
- **Agent 2:** cartesian/Bar, cartesian/BarStack, cartesian/Scatter
- **Agent 3:** polar/Pie, polar/Radar, polar/RadialBar, polar/PolarGrid
- **Agent 4:** component/Tooltip, component/Legend, component/Brush, component/ResponsiveContainer
- **Agent 5:** cartesian/CartesianGrid, cartesian/ReferenceLine, cartesian/ErrorBar, cartesian/Funnel

### Phase 4: Chart Wrappers (3 agents parallel)

- **Agent A:** CartesianChart family (LineChart, BarChart, AreaChart, ScatterChart, ComposedChart)
- **Agent B:** PolarChart family (PieChart, RadarChart, RadialBarChart)
- **Agent C:** Standalone charts (Sankey, Treemap, SunburstChart, FunnelChart)

### Phase 5: Integration (sequential)

- hooks.ts, index.ts, synchronisation/
- Integration testing

## Public API Surface (index.ts exports)

### Charts (13)

LineChart, BarChart, PieChart, AreaChart, ScatterChart, ComposedChart, RadarChart, RadialBarChart, FunnelChart, Treemap, Sankey, SunburstChart

### Cartesian (13)

Line, Bar, Area, Scatter, XAxis, YAxis, ZAxis, CartesianAxis, CartesianGrid, Brush, ReferenceLine, ReferenceDot, ReferenceArea, ErrorBar, BarStack, Funnel

### Polar (6)

Pie, Radar, RadialBar, PolarGrid, PolarAngleAxis, PolarRadiusAxis

### Components (9)

Tooltip, Legend, DefaultTooltipContent, DefaultLegendContent, ResponsiveContainer, Cell, Text, Label, LabelList, Customized

### Shapes (8)

Sector, Curve, Rectangle, Polygon, Dot, Cross, Symbols, Trapezoid

### Other (5)

Surface, Layer, Global, ZIndexLayer, DefaultZIndexes, getNiceTickValues, getRelativeCoordinate

### Public Hooks (17)

useActiveTooltipLabel, useOffset, usePlotArea, useActiveTooltipDataPoints, useXAxisDomain, useYAxisDomain, useIsTooltipActive, useActiveTooltipCoordinate, useXAxisScale, useYAxisScale, useXAxisInverseScale, useXAxisInverseDataSnapScale, useXAxisInverseTickSnapScale, useYAxisInverseScale, useYAxisInverseDataSnapScale, useYAxisInverseTickSnapScale, useXAxisTicks, useYAxisTicks, useCartesianScale, useChartHeight, useChartWidth, useMargin
