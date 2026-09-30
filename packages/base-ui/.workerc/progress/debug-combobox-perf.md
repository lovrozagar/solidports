---
title: Debug: Combobox 250-item hover/arrow lag
session: debug-combobox-perf
spec: None
status: active
---

## Current Focus

hypothesis: CONFIRMED — all 250 items subscribe to activeIndex, re-render on every navigation
fix: createMemo on highlighted + matchesSelectedValue + rootProps in ComboboxItem.tsx
status: RESOLVED — 86/86 tests green

## Symptoms

expected: hover/arrow navigation snappy for 250 items
actual: extremely laggy — "instantly sluggish" — hover + arrow both affected
errors: none reported
reproduction: /solid/components/combobox "Input inside popup" demo, cycle options

## Eliminated

(none yet)

## Evidence

(none yet)

## Log

- [ ] (2026-04-25) (debug) created debug file, beginning file reads

## Files

- packages/solid/src/combobox/item/ComboboxItem.tsx
- packages/solid/src/combobox/store.ts
- packages/solid/src/combobox/root/AriaCombobox.tsx
- packages/solid/src/floating-ui-solid/hooks/useInteractions.ts
- packages/solid/src/floating-ui-solid/hooks/useListNavigation.ts
- packages/solid/src/utils/store/SolidStoreV2.ts
