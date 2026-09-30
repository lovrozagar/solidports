# base-ui solid port — typecheck + oxlint cleanup

Snapshot 2026-04-26. Run from `packages/solid/`.

## Verify commands

- [ ] `bunx tsc -b tsconfig.build.json` (must run before test typecheck — emits .d.ts)
- [ ] `bunx tsc --noEmit -p tsconfig.test.json`
- [ ] per-dir oxlint: `for d in src/*/; do bunx oxlint --format unix "$d"; done` (full `oxlint src` hangs)

## TS errors (11) — post `tsc -b`

- [x] `src/utils/store/SolidStore.spec.ts:3` — TS2307 — change `from './testUtils'` → `from '#test-utils'`
- [x] `src/internals/composite/root/CompositeRoot.tsx:106` — widen `refs?` to `Array<RefOrCb | Array<RefOrCb | null | undefined>>` (test at line 831 expects nested-array flatten — kills 1 TS2322 + 2 TS7006)
- [x] `src/merge-props/mergeProps.ts:158-167` — add overload accepting trailing `MergePropsOptions`: `(...args: [...PropsInput<E>[], MergePropsOptions]): R` — kills 4x TS2353 in `mergeProps.test.ts:356,380,406,440`
- [x] `src/utils/types.ts:5-7` — narrow `UseRenderElementRef` callback param `T | null | undefined` → `T | null` (Solid refs only fire `T | null` at runtime) — kills `ScrollAreaCorner.test.tsx:33` + `useRender.test.tsx:46`
- [x] `src/merge-props/mergeProps.ts:121` — broaden `ElementType` to include `ValidComponent` so `mergeProps<typeof Select.Root<any>>` compiles — kills `SelectRoot.spec.tsx:224` TS2344
- [x] `src/floating-ui-solid/hooks/useTypeahead.test.tsx:96,112,125,165,174,233` — type mocks: `vi.fn<UseTypeaheadProps['onMatch']>()` and `<...['onTypingChange']>()`

### Cascade fixes (from above)

- [x] `src/utils/useRenderElement.tsx:169-177` — widen `ref` to allow extra nesting level (CompositeRoot pass-through)
- [x] `src/use-render/useRender.test.tsx:33,46` — widen `refs` array + ref param to `T | null`
- [x] `src/scroll-area/corner/ScrollAreaCorner.test.tsx:5` — widen `mockViewportMetrics` param to `T | null | undefined`
- [x] `src/combobox/root/ComboboxRoot.spec.tsx:268` — drop unused `@ts-expect-error` (now resolved by ElementType broadening)

### Verify

- [x] `bunx tsc -b tsconfig.build.json` clean
- [x] `bunx tsc --noEmit -p tsconfig.test.json` clean (0 errors, was 11)
- [x] `bun test:solid:jsdom --run` — no regressions: 39 fail / 200 pass / 4 skip files; 67 fail / 4197 pass / 583 skip tests; 64 errors (identical to baseline)

## Oxlint errors (953)

### Source — bug-class

- [ ] `src/utils/useSwipeDismiss.ts:497` — `oxc(const-comparisons)` — both sides identical, real logic bug, investigate
- [ ] `src/utils/useSwipeDismiss.ts:747` — `oxc(const-comparisons)` — same
- [ ] `src/internals/composite/composite.ts:172` — `no-param-reassign` `element` → local
- [ ] `src/internals/composite/list/useCompositeListItem.ts:35` — `no-param-reassign` `indexRef` → local
- [ ] `src/merge-props/mergeProps.ts:113` — `no-param-reassign` `a` → local
- [ ] `src/merge-props/mergeProps.ts:115` — `no-param-reassign` `b` → local
- [ ] `src/floating-ui-solid/utils/composite.ts:127` — `no-useless-length-check` (+1 more) drop redundant guard
- [ ] `src/floating-ui-solid/hooks/useListNavigation.ts:731` — `no-nested-ternary` extract (+2 more sites)

### Source — bulk mechanical

- [ ] `bunx oxlint --fix` per dir — autofixes most of 263 source `eqeqeq` (`==`→`===`)
- [ ] 354x `no-explicit-any` (source) — replace per-site with `unknown` + guards or generics; hot spots: `AccordionRoot.tsx:149`, `AccordionItem.tsx:175`, `AutocompleteRoot.tsx:22,119`, `AutocompleteItem.tsx:42`, `CheckboxRoot.tsx:376,377,458`, `combobox/root/utils/constants.ts:2`, `combobox/root/AriaCombobox.tsx:71`
- [ ] 69x `no-non-null-assertion` (source) — replace `x!.y` with optional chain + invariant; hot spots: `useImageLoadingStatus.ts:41,44`, `CheckboxRoot.tsx:114,126,128(x2),171(x2),176(x2)`

### Tests — config override (recommended)

- [ ] add `packages/solid/.oxlintrc.json` extending root with override for `**/*.test.*` + `**/*.spec.*` disabling: `typescript-eslint/no-non-null-assertion`, `eslint/no-unassigned-vars`, `eslint/no-unused-expressions`, `eslint/eqeqeq` — kills ~253 test errors

### Tests — alt refactor (skip if config override taken)

- [ ] 197x test `no-non-null-assertion` — drop `!` post-DOM-query
- [ ] 25x `no-unassigned-vars` (`DialogPopup.test.tsx`, etc.) — `let inputRef!: HTMLInputElement` or callback ref
- [ ] 18x `no-unused-expressions` in `*.spec.tsx` — wrap with `expectType<T>(value)`
- [ ] 13x test `eqeqeq` — `--fix`

## Oxlint warnings (2160)

- [ ] decide `sort-keys` (1993 warns) — recommend disable for this package in local config; OR run `--fix`
- [ ] 81x `no-unused-vars` — `--fix` removes unused imports; manual for unused locals
- [ ] 52x `solid/reactivity` — review per-site, real port artifacts (destructured props, accessor outside tracking)
- [ ] 22x `import/no-cycle` — break component-internal cycles by moving shared types to `types.ts`
- [ ] 3x `oxc/no-map-spread`
- [ ] 3x `oxc/approx-constant`
- [ ] 2x `unicorn/prefer-add-event-listener`
- [ ] 2x `promise/no-callback-in-promise`
- [ ] 1x `unicorn/no-useless-fallback-in-spread`
- [ ] 1x `promise/no-return-wrap`

## Execution order

- [ ] step 1 — ensure `tsc -b tsconfig.build.json` runs in CI before test typecheck
- [ ] step 2 — fix 11 TS errors
- [ ] step 3 — add package-local `.oxlintrc.json` test override → -253 errors
- [ ] step 4 — `bunx oxlint --fix` per dir → kills bulk eqeqeq + many warnings
- [ ] step 5 — fix 2 `useSwipeDismiss` `const-comparisons` bugs
- [ ] step 6 — sweep 354 `any`, 69 source `non-null-assertion`, 4 `param-reassign`, misc
- [ ] step 7 — decide `sort-keys` policy
- [ ] step 8 — `solid/reactivity` audit as porting QA
