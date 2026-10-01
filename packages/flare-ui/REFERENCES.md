# flare-ui — References

Agents working on flare-ui: read this before authoring or modifying components.

## Headless base — @solidports/base-ui

Primary dependency. Local Solid port of MUI Base UI at `packages/base-ui/packages/solid/`. Package name `@solidports/base-ui`.

- Port source: `packages/base-ui/packages/solid/src/`
- Port entry per primitive: `@solidports/base-ui/<name>` (e.g. `@solidports/base-ui/dialog`)
- Drawer namespace: `import { Drawer as BaseDrawer } from "@solidports/base-ui/drawer"`
- `DrawerHandle` in this package is a visual grabber `<div>`, not `Drawer.Indent` (Indent wraps the page on 1.8) and not `Drawer.createHandle()` (imperative handle).
- Alert dialog wraps `@solidports/base-ui/alert-dialog` so the popup has `role="alertdialog"`.
- React docs (API concepts): https://base-ui.com/react/components/
- Styling handbook: https://base-ui.com/react/handbook/styling

## Styling pipeline

flare-ui ships **raw TSX source only** — no `dist/`, no build step. Consumer Tailwind v4 scans flare-ui source alongside their own code.

Consumer app CSS:

```css
@import "tailwindcss";
@import "@solidports/flare-ui/styles/theme.css";
@source "../node_modules/@solidports/flare-ui/src";
```

Workspace monorepo alternative (bun symlink):

```css
@source "../../packages/flare-ui/src";
```

## Animation conventions

Base UI uses `data-starting-style` / `data-ending-style` for enter/exit transitions — NOT Radix-era `data-[state=open]:animate-in`. All flare-ui enter/exit animations target these attributes:

```
data-[starting-style]:opacity-0     — fade in
data-[ending-style]:opacity-0       — fade out
data-[starting-style]:scale-95      — zoom in
data-[ending-style]:scale-95        — zoom out
```

`keyframes.css` ships only 2 keyframes for height-based Accordion/Collapsible transitions (`accordion-down`, `accordion-up`). `tw-animate-css` is rejected — it targets Radix's `data-state` which Base UI does not emit.

## No data-slot

`data-slot` is NOT used in flare-ui. ShadCN's `data-slot` convention serves their CSS-module override model which flare-ui doesn't share. flare-ui uses:

- Tailwind utilities + OKLCH token system for styling
- Base UI native `data-*` state attrs (`data-open`, `data-closed`, `data-highlighted`, `data-selected`, `data-checked`, `data-popup-open`, `data-starting-style`, `data-ending-style`) for styling hooks
- ARIA roles for test selectors

## P1 component inventory — 42 components

### Visual primitives (no port dependency)

| File            | Exports                                                                           | Notes                             |
| --------------- | --------------------------------------------------------------------------------- | --------------------------------- |
| `button.tsx`    | `Button`                                                                          | `data-variant`, `data-size` attrs |
| `badge.tsx`     | `Badge`                                                                           | `data-variant` attr               |
| `label.tsx`     | `Label`                                                                           | Wraps `<label>`                   |
| `separator.tsx` | `Separator`                                                                       | Wraps port `Separator`            |
| `skeleton.tsx`  | `Skeleton`                                                                        | Pure `<div animate-pulse>`        |
| `spinner.tsx`   | `Spinner`                                                                         | SVG `animate-spin`                |
| `avatar.tsx`    | `Avatar`, `AvatarImage`, `AvatarFallback`                                         | Wraps port `Avatar`               |
| `alert.tsx`     | `Alert`, `AlertTitle`, `AlertDescription`                                         | Pure visual                       |
| `card.tsx`      | `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`, `CardFooter` | Pure visual                       |

### Port-backed primitives (simple shape)

| File               | Exports                          | Port import                                 |
| ------------------ | -------------------------------- | ------------------------------------------- |
| `input.tsx`        | `Input`                          | `@solidports/base-ui/input`                 |
| `textarea.tsx`     | `Textarea`                       | Native `<textarea>`                         |
| `checkbox.tsx`     | `Checkbox`                       | `@solidports/base-ui/checkbox`              |
| `radio-group.tsx`  | `RadioGroup`, `RadioGroupItem`   | `@solidports/base-ui/radio-group` + `radio` |
| `switch.tsx`       | `Switch`                         | `@solidports/base-ui/switch`                |
| `toggle.tsx`       | `Toggle`                         | `@solidports/base-ui/toggle`                |
| `toggle-group.tsx` | `ToggleGroup`, `ToggleGroupItem` | `@solidports/base-ui/toggle-group`          |
| `meter.tsx`        | `Meter`                          | `@solidports/base-ui/meter`                 |

### Compound primitives

| File                  | Key exports                                                                                                                                                    | Slot rename                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `dialog.tsx`          | `Dialog`, `DialogTrigger`, `DialogPortal`, `DialogClose`, `DialogOverlay`, `DialogContent`, `DialogHeader`, `DialogFooter`, `DialogTitle`, `DialogDescription` | `Backdrop→Overlay`, `Popup→Content`                                             |
| `alert-dialog.tsx`    | Same shape + `AlertDialogAction`, `AlertDialogCancel`                                                                                                          | wraps `@solidports/base-ui/alert-dialog`; `Backdrop→Overlay`, `Popup→Content`   |
| `sheet.tsx`           | `Sheet*` — wraps dialog with `side` prop                                                                                                                       | `Backdrop→Overlay`, `Popup→Content`                                             |
| `drawer.tsx`          | `Drawer*`, `DrawerHandle`                                                                                                                                      | `Backdrop→Overlay`, `Popup→Content`; `DrawerHandle` is a styled grabber `<div>` |
| `popover.tsx`         | `Popover`, `PopoverTrigger`, `PopoverPortal`, `PopoverContent`, `PopoverArrow`, `PopoverClose`, `PopoverTitle`, `PopoverDescription`                           | `Popup→Content` (Positioner baked in)                                           |
| `tooltip.tsx`         | `TooltipProvider`, `Tooltip`, `TooltipTrigger`, `TooltipPortal`, `TooltipContent`, `TooltipArrow`                                                              | `Popup→Content`                                                                 |
| `hover-card.tsx`      | `HoverCard`, `HoverCardTrigger`, `HoverCardPortal`, `HoverCardContent`                                                                                         | `PreviewCard→HoverCard`, `Popup→Content`                                        |
| `dropdown-menu.tsx`   | `DropdownMenu*`                                                                                                                                                | wraps `@solidports/base-ui/menu`                                                |
| `context-menu.tsx`    | `ContextMenu*`                                                                                                                                                 | wraps `@solidports/base-ui/context-menu`                                        |
| `menubar.tsx`         | `Menubar*`                                                                                                                                                     | wraps `@solidports/base-ui/menubar` + `menu`                                    |
| `navigation-menu.tsx` | `NavigationMenu*`                                                                                                                                              | wraps `@solidports/base-ui/navigation-menu`                                     |
| `accordion.tsx`       | `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`                                                                                           | `Panel→Content`                                                                 |
| `collapsible.tsx`     | `Collapsible`, `CollapsibleTrigger`, `CollapsibleContent`                                                                                                      | `Panel→Content`                                                                 |
| `tabs.tsx`            | `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`                                                                                                               | `Tab→TabsTrigger`, `Panel→TabsContent`                                          |
| `scroll-area.tsx`     | `ScrollArea`, `ScrollBar`, `ScrollAreaCorner`                                                                                                                  | composes Root+Viewport+Content                                                  |
| `progress.tsx`        | `Progress`                                                                                                                                                     | composes Root+Track+Indicator                                                   |
| `slider.tsx`          | `Slider`, `SliderRange`, `SliderThumb`, `SliderTrack`                                                                                                          | `Control→SliderTrack`, `Indicator→SliderRange`                                  |
| `combobox.tsx`        | `Combobox*` (26 parts)                                                                                                                                         | `Popup→ComboboxContent`                                                         |
| `select.tsx`          | `Select*`                                                                                                                                                      | `Popup→SelectContent`, `ScrollUpArrow→SelectScrollUpButton`                     |
| `autocomplete.tsx`    | `Autocomplete*`                                                                                                                                                | reuses Combobox parts                                                           |
| `number-field.tsx`    | `NumberField*`                                                                                                                                                 | 7 parts incl. ScrubArea                                                         |
| `otp-field.tsx`       | `OTPField`, `OTPFieldInput`, `OTPFieldGroup`, `OTPFieldSlot`, `OTPFieldSeparator`                                                                              | visual Group/Slot/Separator flare-ui defined                                    |
| `toast.tsx`           | `ToastProvider`, `Toast*`, `useToast`, `createToaster`                                                                                                         | `useToastManager→useToast`, `createToastManager→createToaster`                  |
| `form.tsx`            | `Form`                                                                                                                                                         | single wrapper                                                                  |

### Field compound (visual-only, no port dep)

| File        | Exports                                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------------------------------- |
| `field.tsx` | `FieldRoot`, `FieldLabel`, `FieldLabelGroup`, `FieldDescription`, `FieldError`, `FieldMessage`, `useFieldContext` |

## Token system

3-layer OKLCH. Source of truth: `src/styles/tokens.css`.

- L1: `--neutral-0..950` + `--radius`
- L2: 25 color semantics (surface/brand ref L1 via `var()`, status colors raw OKLCH) + ring + typography + z-index
- L3: `.dark` re-maps color semantics; non-color tokens unchanged

Theme bridge: `src/styles/theme.css` exposes L2 under Tailwind v4 `--color-*` / `--radius-*` / `--font-*` / `--z-index-*` / `--default-ring-*` / `--animate-*` namespaces. Consumer `@import`s this file; imports Tailwind separately.

## Testing

- Fixture: `tests/fixture/` — plain Solid SPA, no Flare plugin, Tailwind v4 + `@tailwindcss/vite`, HTTP on port 4099
- E2E: `tests/e2e/` — Playwright + axe-core. `a11y.spec.ts` iterates 42 routes × 2 dirs × 2 themes. `interactions/` has 23 compound specs.
- Default `bun run test` is `playwright test --project=chromium-ltr`. Full matrix is `bun run test:all`.
- Selectors: `getByRole()`, `getByText()`, Base UI `data-open`/`data-orientation` etc. Never `[data-slot=...]`.
