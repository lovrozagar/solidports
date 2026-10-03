# Phase 9 — per-chart memoized selector graph (plan 3, step 3)

`chartSelector` (src/state/selectors/chartSelector.ts) gives every chart one lazy memo per (selector, primitive argument tuple), owned by the chart provider. Production builds; Solid 5193, React 5184. Ratio = Solid / React.

## Phase 2 -> phase 3

```
# phase-2 -> phase-3
metric                   solid    react  ratio  prev ratio  Δ ratio         
mount JS sum           1107.12  1001.95   1.10        1.61   -31.5%         
tFirstPaint sum        2758.20  2787.40   0.99        1.16   -14.9%         
rAF total ms             36.24    34.64   1.05        0.95    +9.7%  REGRESS
hover line                1.53     2.03   0.75        4.47   -83.1%         
hover bar                 1.38     2.26   0.61        3.45   -82.2%         
hover area                1.22     1.77   0.69        4.45   -84.5%         
hover composed            1.63     2.55   0.64        4.95   -87.1%         
hover scatter             0.10     0.26   0.37        0.87   -57.2%         
hover pie                 0.38     0.58   0.66        1.02   -35.2%         
hover radar               0.96     1.84   0.52        2.41   -78.3%         
switch paint bar         96.25    86.50   1.11        4.38   -74.6%         
switch paint area       102.75    73.30   1.40        4.96   -71.8%         
switch paint composed    64.20    56.05   1.15        4.16   -72.5%         
switch paint pie         40.90    40.75   1.00        1.51   -33.5%         
switch paint radar       42.95    36.60   1.17        2.03   -42.1%         
switch paint radial      29.80    28.60   1.04        2.50   -58.2%         
switch paint scatter     63.10    47.80   1.32        4.11   -67.9%         
switch paint funnel      24.85    26.80   0.93        1.03    -9.8%         
switch paint sankey      28.55    28.25   1.01        1.00    +1.2%         
switch paint treemap     37.75    29.85   1.26        1.13   +12.4%         
switch paint sunburst    23.05    28.15   0.82        0.85    -3.9%         
switch paint line       100.15    79.80   1.26        5.27   -76.2%         
heap growth MB            3.21     2.64   1.22        1.32    -7.9%         

1 headline regression(s) > 5%
```

The rAF headline sums total callback time over routes that animate on both sides (the earlier sum of per-route averages was dominated by zero-frame routes). The +10% flag is within run noise: an 8-pass rerun gave 1.06x, and line animation-window profiles of the phase-2 and phase-3 builds are equal (132 vs 135 ms/run, no selector frames). The remaining per-frame cost is `getTotalLength` in LineDrawShape, cached per path `d` in phase 4.

## Tooltip chain only (3.6 gate, hover)

```
metric                  solid  react  ratio  prev ratio  Δ ratio  
hover line               1.79   1.83   0.98        4.47   -78.1%  
hover bar                1.73   1.70   1.02        3.45   -70.5%  
hover area               1.38   1.61   0.86        4.45   -80.7%  
hover composed           1.74   1.67   1.04        4.95   -78.9%  
hover scatter            0.09   0.14   0.61        0.87   -30.5%  
hover pie                0.39   0.41   0.94        1.02    -7.8%  
hover radar              1.02   1.28   0.80        2.41   -67.0%  
```

## Phase 3 -> phase 4 (consumer-side cleanup)

Dot single pass, own-key iteration without descriptor traps, Pie rest props per series, LineDrawShape length cache. Interact half rerun (phase-4b) after a loaded first run; hover/sunburst flags were checked against unminified profiles of both builds (pie hover 15.2 vs 15.3 ms/run, radar 27.6 vs 27.1, sunburst mount 45.9 vs 46.1) and are run noise.

```
# phase-3 -> phase-4b
metric                   solid    react  ratio  prev ratio  Δ ratio         
mount JS sum           1045.32  1009.15   1.04        1.10    -6.3%         
tFirstPaint sum        2751.80  2792.40   0.99        0.99    -0.4%         
rAF total ms             36.90    35.60   1.04        1.05    -0.9%         
hover line                1.34     1.81   0.74        0.75    -2.0%         
hover bar                 1.24     1.93   0.64        0.61    +4.3%         
hover area                1.23     1.80   0.68        0.69    -1.2%         
hover composed            1.36     1.92   0.71        0.64   +11.3%         
hover scatter             0.07     0.24   0.28        0.37   -24.8%         
hover pie                 0.42     0.45   0.94        0.66   +42.4%         
hover radar               0.85     1.32   0.64        0.52   +23.1%         
switch paint bar         97.45    80.50   1.21        1.11    +8.8%         
switch paint area       100.30    70.20   1.43        1.40    +1.9%         
switch paint composed    64.20    56.65   1.13        1.15    -1.1%         
switch paint pie         37.40    39.90   0.94        1.00    -6.6%         
switch paint radar       43.70    37.55   1.16        1.17    -0.8%         
switch paint radial      29.95    28.50   1.05        1.04    +0.9%         
switch paint scatter     63.45    46.65   1.36        1.32    +3.0%         
switch paint funnel      25.50    27.00   0.94        0.93    +1.9%         
switch paint sankey      27.85    29.10   0.96        1.01    -5.3%         
switch paint treemap     40.10    30.35   1.32        1.26    +4.5%         
switch paint sunburst    31.45    27.80   1.13        0.82   +38.2%  REGRESS
switch paint line        92.95    78.95   1.18        1.26    -6.2%         
heap growth MB            3.37     2.67   1.26        1.22    +3.8%         

1 headline regression(s) > 5%
```

## Phase 0 -> phase 4

```
# phase-0 -> phase-4b
metric                   solid    react  ratio  prev ratio  Δ ratio         
mount JS sum           1045.32  1009.15   1.04        2.06   -49.6%         
tFirstPaint sum        2751.80  2792.40   0.99        1.23   -19.9%         
rAF total ms             36.90    35.60   1.04        1.02    +2.0%         
hover line                1.34     1.81   0.74       12.39   -94.0%         
hover bar                 1.24     1.93   0.64        8.69   -92.7%         
hover area                1.23     1.80   0.68       10.72   -93.6%         
hover composed            1.36     1.92   0.71       12.45   -94.3%         
hover scatter             0.07     0.24   0.28        0.43   -33.9%         
hover pie                 0.42     0.45   0.94        2.77   -65.9%         
hover radar               0.85     1.32   0.64        9.73   -93.4%         
switch paint bar         97.45    80.50   1.21        5.48   -77.9%         
switch paint area       100.30    70.20   1.43        6.94   -79.4%         
switch paint composed    64.20    56.65   1.13        5.24   -78.4%         
switch paint pie         37.40    39.90   0.94        2.76   -66.0%         
switch paint radar       43.70    37.55   1.16        2.94   -60.4%         
switch paint radial      29.95    28.50   1.05        3.24   -67.5%         
switch paint scatter     63.45    46.65   1.36        5.56   -75.5%         
switch paint funnel      25.50    27.00   0.94        1.41   -33.2%         
switch paint sankey      27.85    29.10   0.96        1.00    -4.6%         
switch paint treemap     40.10    30.35   1.32        1.69   -21.6%         
switch paint sunburst    31.45    27.80   1.13        0.73   +54.4%  REGRESS
switch paint line        92.95    78.95   1.18        6.94   -83.0%         
heap growth MB            3.37     2.67   1.26        1.28    -1.1%         

1 headline regression(s) > 5%
```
