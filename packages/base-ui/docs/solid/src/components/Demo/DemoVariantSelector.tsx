import { Show } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitProps } from '../../utils/solid-1-compat';
import * as Select from "../Select"

const translations: Record<string, string> = {
  Default: "Default",
  System: "MUI System",
  Css: "Plain CSS",
  CssModules: "CSS Modules",
  Tailwind: "Tailwind v4",
}

export interface DemoVariantSelectorProps extends JSX.HTMLAttributes<HTMLDivElement> {
  onVariantChange?: () => void
  showLanguageSelector?: boolean
  variants: string[]
  selectedVariant: Accessor<string | null> | string | null
  selectVariant: (value: string | null) => void
  availableTransforms: string[]
  selectedTransform: Accessor<string | null> | string | null
  selectTransform: (transformName: string | null) => void
}

function unwrap<T>(value: Accessor<T> | T): T {
  return typeof value === "function" ? (value as Accessor<T>)() : value
}

export function DemoVariantSelector(props: DemoVariantSelectorProps) {
  const [local, rest] = splitProps(props, [
    "variants",
    "selectedVariant",
    "selectVariant",
    "availableTransforms",
    "selectedTransform",
    "selectTransform",
    "showLanguageSelector",
    "onVariantChange",
  ])

  const hasJsTransform = () => local.availableTransforms.includes("js")

  function handleLanguageChange(value: string | null) {
    local.selectTransform(value === "ts" ? null : value)
  }

  function handleVariantChange(value: string | null) {
    local.selectVariant(value)
    local.onVariantChange?.()
  }

  return (
    <div {...rest}>
      <Show when={hasJsTransform()}>
        <Select.Root
          items={[
            { value: "ts", label: "TS" },
            { value: "js", label: "JS" },
          ]}
          value={unwrap(local.selectedTransform) || "ts"}
          onValueChange={handleLanguageChange}
        >
          <Select.Trigger />
          <Select.Popup>
            <Select.Item value="ts">TS</Select.Item>
            <Select.Item value="js">JS</Select.Item>
          </Select.Popup>
        </Select.Root>
      </Show>

      <Show when={local.variants.length > 1}>
        <Select.Root
          items={translations}
          value={unwrap(local.selectedVariant)}
          onValueChange={handleVariantChange}
        >
          <Select.Trigger aria-label="Styling method" />
          <Select.Popup>
            {local.variants.map((variantName) => (
              <Select.Item value={variantName}>{translations[variantName]}</Select.Item>
            ))}
          </Select.Popup>
        </Select.Root>
      </Show>
    </div>
  )
}
