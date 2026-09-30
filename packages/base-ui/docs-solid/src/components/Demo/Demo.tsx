import {
  createMemo,
  createSignal,
  onMount,
  Show,
  For,
  type JSX,
} from "solid-js"
import { useLocation } from "@solidjs/router"
import { Collapsible } from "@solidports/base-ui/collapsible"
import clsx from "clsx"
import { CopyIcon } from "../../icons/CopyIcon"
import { CheckIcon } from "../../icons/CheckIcon"
import { ExternalLinkIcon } from "../../icons/ExternalLinkIcon"
import { isSafari, isEdge } from "../../utils/detect-browser"
import { DemoVariantSelector } from "./DemoVariantSelector"
import { DemoFileSelector } from "./DemoFileSelector"
import { DemoCodeBlock } from "./DemoCodeBlock"
import { DemoPlayground } from "./DemoPlayground"
import { GhostButton } from "../GhostButton"
import { useDemo } from "./useDemo"

function kebabCase(input: string) {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase()
}

export interface DemoProps {
  name?: string
  slug?: string
  /** Relative path to src/demos/solid/<path>, e.g. "accordion/hero". */
  path: string
  defaultOpen?: boolean
  compact?: boolean
  class?: string
  showExtraPlaygroundLink?: boolean
}

/** Upstream `Demo.tsx` ported 1:1 at syntax level — tab switcher, copy button,
    show-code Collapsible, StackBlitz/CodeSandbox link (disabled stubs),
    variant selector. Load pipeline defined in `useDemo.tsx`. */
export function Demo(props: DemoProps) {
  let collapsibleTriggerRef: HTMLButtonElement | undefined
  const [copyTimeout, setCopyTimeout] = createSignal<number>(0)
  const location = useLocation()

  const demoSlug = createMemo(() => {
    if (props.slug) return props.slug
    if (props.name) return kebabCase(props.name)
    return undefined
  })
  function onCopied() {
    /* eslint-disable no-restricted-syntax */
    const newTimeout = window.setTimeout(() => {
      window.clearTimeout(newTimeout)
      setCopyTimeout(0)
    }, 2000)
    window.clearTimeout(copyTimeout())
    setCopyTimeout(newTimeout)
    /* eslint-enable no-restricted-syntax */
  }

  const demo = useDemo(
    { name: props.name, path: props.path, slug: props.slug },
    { copy: { onCopied }, defaultOpen: props.defaultOpen },
  )

  const [fallbackToCodeSandbox, setFallbackToCodeSandbox] = createSignal(false)
  onMount(() => {
    if (isSafari || isEdge) setFallbackToCodeSandbox(true)
  })

  function onOpenChange(nextOpen: boolean) {
    /* Upstream uses ReactDOM.flushSync to read the trigger rect before/after close so
       the scroll-adjust runs in the same frame. Solid's updates are synchronous in
       event handlers so we can read rects directly around setExpanded. */
    if (!nextOpen && collapsibleTriggerRef !== null && collapsibleTriggerRef !== undefined) {
      const triggerEl = collapsibleTriggerRef
      const rectTopBeforeClose = triggerEl.getBoundingClientRect().top
      demo.setExpanded(nextOpen)
      const rectTopAfterClose = triggerEl.getBoundingClientRect().top
      const delta = rectTopAfterClose - rectTopBeforeClose
      if (rectTopAfterClose < 0) {
        window.scrollBy({ behavior: "instant" as ScrollBehavior, top: delta })
      }
      return
    }
    demo.setExpanded(nextOpen)
  }

  function onSelectFile(fileName: string) {
    demo.selectFileName(fileName)
  }

  const showToolbar = () => !props.compact || demo.expanded()

  const externalPlaygroundLink = () =>
    fallbackToCodeSandbox() ? (
      <GhostButton aria-label="Open in CodeSandbox" type="button" onClick={demo.openCodeSandbox}>
        CodeSandbox
        <ExternalLinkIcon />
      </GhostButton>
    ) : (
      <GhostButton aria-label="Open in StackBlitz" type="button" onClick={demo.openStackBlitz}>
        StackBlitz
        <ExternalLinkIcon />
      </GhostButton>
    )

  const rootClass = () => clsx("DemoRoot", props.class)

  return (
    <div class={rootClass()}>
      <For each={demo.allFilesSlugs()}>
        {(entry) => <span id={entry.slug} class="scroll-mt-4" />}
      </For>
      <div>
        <DemoPlayground component={demo.component} variant={demo.selectedVariant()}>
          <Show when={props.showExtraPlaygroundLink}>
            <span class="absolute top-3 right-4.5">{externalPlaygroundLink()}</span>
          </Show>
        </DemoPlayground>
      </div>
      <Collapsible.Root open={demo.expanded()} onOpenChange={onOpenChange}>
        <div role="figure" aria-label="Component demo code">
          <Show when={showToolbar()}>
            <div class="DemoToolbar">
              <DemoFileSelector
                files={demo.files()}
                selectedFileName={demo.selectedFileName()}
                selectFileName={onSelectFile}
                onTabChange={demo.expand}
              />

              <div class="DemoToolbarActions">
                <DemoVariantSelector
                  class="contents"
                  onVariantChange={demo.expand}
                  variants={demo.variants}
                  selectedVariant={demo.selectedVariant}
                  selectVariant={demo.selectVariant as (value: string | null) => void}
                  availableTransforms={demo.availableTransforms}
                  selectedTransform={demo.selectedTransform}
                  selectTransform={demo.selectTransform}
                />
                {externalPlaygroundLink()}
                <GhostButton aria-label="Copy code" onClick={demo.copy}>
                  Copy
                  <span class="flex size-3.5 items-center justify-center">
                    <Show when={copyTimeout()} fallback={<CopyIcon />}>
                      <CheckIcon />
                    </Show>
                  </span>
                </GhostButton>
              </div>
            </div>
          </Show>

          <DemoCodeBlock
            selectedFile={demo.selectedFile()}
            selectedFileLines={demo.selectedFileLines()}
            collapsibleOpen={demo.expanded()}
            collapsibleTriggerRef={(el) => (collapsibleTriggerRef = el ?? undefined)}
            compact={Boolean(props.compact)}
          />
        </div>
      </Collapsible.Root>
    </div>
  )
}
