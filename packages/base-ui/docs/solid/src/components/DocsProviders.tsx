import type { ParentProps } from 'solid-js';
import { Tooltip } from "@solidports/base-ui/tooltip"
import { DemoVariantSelectorProvider } from "./Demo/DemoVariantSelectorProvider"
import { PackageManagerSnippetProvider } from "../blocks/PackageManagerSnippet/PackageManagerSnippetProvider"

export function DocsProviders(props: ParentProps) {
  return (
    <Tooltip.Provider delay={350}>
      <DemoVariantSelectorProvider defaultVariant="CssModules" defaultLanguage="ts">
        <PackageManagerSnippetProvider defaultValue="npm">
          {props.children}
        </PackageManagerSnippetProvider>
      </DemoVariantSelectorProvider>
    </Tooltip.Provider>
  )
}
