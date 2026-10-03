# Phase 9 — hotspot quick wins (plan 3, step 2)

Production builds, Solid preview on 5193, React on 5184. Bench: `rv-s-mount.mjs` (5 passes × 12 routes) and `rv-s-interact.mjs` (4× CPU throttle). Ratio = Solid / React. Gate: no headline ratio regresses > 5% vs phase 0.

Changes: `selectTooltipSettings` returns the store node (or a cached live index view) instead of spreading; item-list selectors do one `for...in` pass; SVG prop filtering uses one canonical-key map lookup per key; `isEventKey` is a Set lookup and `adaptEventHandlers` allocates only when a handler exists; Line measures `getTotalLength` once per `d` and never when `isAnimationActive={false}`.

```
# phase-0 -> phase-2
metric                   solid    react  ratio  prev ratio  Δ ratio  
mount JS sum           1555.88   963.93   1.61        2.06   -21.5%  
tFirstPaint sum        3235.40  2781.20   1.16        1.23    -5.5%  
avgRaf sum                0.15     0.19   0.80        0.69   +17.4%  
hover line               10.27     2.30   4.47       12.39   -63.9%  
hover bar                 7.59     2.20   3.45        8.69   -60.3%  
hover area                9.33     2.10   4.45       10.72   -58.5%  
hover composed           10.73     2.17   4.95       12.45   -60.3%  
hover scatter             0.17     0.19   0.87        0.43  +105.4%  
hover pie                 0.89     0.88   1.02        2.77   -63.1%  
hover radar               5.98     2.48   2.41        9.73   -75.2%  
switch paint bar        420.25    95.90   4.38        5.48   -20.0%  
switch paint area       404.15    81.40   4.96        6.94   -28.5%  
switch paint composed   252.90    60.75   4.16        5.24   -20.6%  
switch paint pie         62.35    41.30   1.51        2.76   -45.3%  
switch paint radar       78.25    38.60   2.03        2.94   -31.0%  
switch paint radial      77.85    31.20   2.50        3.24   -22.9%  
switch paint scatter    234.90    57.15   4.11        5.56   -26.0%  
switch paint funnel      27.70    26.95   1.03        1.41   -27.3%  
switch paint sankey      27.75    27.80   1.00        1.00    -0.5%  
switch paint treemap     39.55    35.15   1.13        1.69   -33.2%  
switch paint sunburst    21.85    25.65   0.85        0.73   +16.2%  
switch paint line       416.65    79.05   5.27        6.94   -24.0%  
heap growth MB            3.54     2.68   1.32        1.28    +3.5%  
```

## Line mount profile (unminified, ms self per run, top 15)

```
active ms/run 323.8
   16.70 selectUnfilteredCartesianItems index-cVbOyi71.js:20036
   15.47 (gc)
   15.35 svgPropertiesNoEvents index-cVbOyi71.js:8586
   15.16 getTotalLength$1 index-cVbOyi71.js:29973
   11.59 adaptEventHandlers index-cVbOyi71.js:10357
    8.11 setAttribute index-cVbOyi71.js:7238
    7.39 get index-cVbOyi71.js:4763
    7.00 recompute index-cVbOyi71.js:2082
    4.39 link index-cVbOyi71.js:1571
    3.97 read index-cVbOyi71.js:2838
    3.76 selectAllXAxes index-cVbOyi71.js:12698
    3.72 selectAllYAxes index-cVbOyi71.js:12701
    3.57 sourceDescriptor index-cVbOyi71.js:6090
    3.48 (anon) index-cVbOyi71.js:35130
    3.15 reconcileArrays index-cVbOyi71.js:7035
```

## Line hover profile (61 moves, ms self per run, top 15)

```
active ms/run 199.9
   31.93 selectAllGraphicalItemsSettings index-cVbOyi71.js:21166
   14.24 get index-cVbOyi71.js:4763
   10.37 getBoundingClientRect :0
    9.43 readNodeFast index-cVbOyi71.js:2831
    7.10 (gc)
    6.40 selectXAxisSettingsNoDefaults index-cVbOyi71.js:19904
    6.20 selectAllYAxes index-cVbOyi71.js:12701
    5.13 selectAllXAxes index-cVbOyi71.js:12698
    4.66 visibleKeys index-cVbOyi71.js:5025
    3.28 (anon) index-cVbOyi71.js:20025
    3.08 getOwnPropertyDescriptor index-cVbOyi71.js:4875
    2.70 read index-cVbOyi71.js:2838
    2.46 selectTooltipDisplayedData index-cVbOyi71.js:21195
    2.38 getTooltipEntry index-cVbOyi71.js:12669
    2.33 selectHasBar index-cVbOyi71.js:20014
```
