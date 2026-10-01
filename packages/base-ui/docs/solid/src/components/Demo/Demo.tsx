import { createMemo, createSignal, onMount, For, type JSX } from "solid-js"
import { useLocation } from "@solidjs/router"
import { Collapsible } from "@solidports/base-ui/collapsible"
import { ScrollArea } from "@solidports/base-ui/scroll-area"
import clsx from "clsx"
import { CopyIcon } from "../../icons/CopyIcon"
import { CheckIcon } from "../../icons/CheckIcon"
import { ExternalLinkIcon } from "../../icons/ExternalLinkIcon"
import { GitHubIcon } from "../../icons/GitHubIcon"
import { MoreVertIcon } from "../../icons/MoreVertIcon"
import { isSafari, isEdge } from "../../utils/detect-browser"
import * as Menu from "../Menu"
import { DemoVariantSelector } from "./DemoVariantSelector"
import { DemoFileSelector } from "./DemoFileSelector"
import { DemoCodeBlock } from "./DemoCodeBlock"
import { DemoPlayground } from "./DemoPlayground"
import { GhostButton } from "../GhostButton"
import { useDemo } from "./useDemo"
import "./Demo.css"

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
  let collapsibleTriggerRef: HTMLElement | undefined
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

  const githubUrl = createMemo(() => {
    const variant = demo.selectedVariant() === "Tailwind" ? "tailwind" : "css-modules"
    const [component, ...rest] = props.path.split("/")
    const demoName = rest.join("/")
    if (!component || !demoName) return null
    return `https://github.com/mui/base-ui/tree/v1.8.0/docs/src/app/(docs)/react/components/${component}/demos/${demoName}/${variant}`
  })

  const toolbarActions = () => (
    <>
      {demo.variants.length > 1 ? (
        <DemoVariantSelector
          onVariantChange={demo.expand}
          variants={demo.variants}
          selectedVariant={demo.selectedVariant}
          selectVariant={demo.selectVariant as (value: string | null) => void}
          availableTransforms={demo.availableTransforms}
          selectedTransform={demo.selectedTransform}
          selectTransform={demo.selectTransform}
        />
      ) : null}
      {externalPlaygroundLink()}
      {githubUrl() ? (
        <Menu.Root>
          <Menu.Trigger
            render={(triggerProps) => (
              <GhostButton
                {...(triggerProps as JSX.ButtonHTMLAttributes<HTMLButtonElement>)}
                layout="icon"
                aria-label="More actions"
              >
                <MoreVertIcon aria-hidden="true" />
              </GhostButton>
            )}
          />
          <Menu.Popup align="end" alignOffset={-5}>
            <Menu.LinkItem href={githubUrl()!} target="_blank" rel="noopener">
              <GitHubIcon aria-hidden="true" />
              View source on GitHub
              <ExternalLinkIcon aria-hidden="true" />
            </Menu.LinkItem>
            <Menu.Item closeOnClick={false} onClick={() => void navigator.clipboard.writeText(githubUrl()!)}>
              {copyTimeout() ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
              Copy link to source
            </Menu.Item>
          </Menu.Popup>
        </Menu.Root>
      ) : null}
    </>
  )

  return (
    <div class={clsx("DemoRoot", props.class)}>
      <For each={demo.allFilesSlugs()}>
        {(entry) => <span id={entry.slug} class="bui-scroll-mt-4" />}
      </For>
      <div>
        <DemoPlayground component={demo.component} variant={demo.selectedVariant()} />
      </div>
      <Collapsible.Root class="DemoCollapsibleRoot" open={demo.expanded()} onOpenChange={onOpenChange}>
        <div role="figure" aria-label="Component demo code">
          <div class="DemoToolbar">
            <ScrollArea.Root class="DemoToolbarScrollAreaRoot">
              <ScrollArea.Viewport class="DemoToolbarViewport">
                <DemoFileSelector
                  files={demo.files()}
                  selectedFileName={demo.selectedFileName()}
                  selectFileName={onSelectFile}
                  onTabChange={demo.expand}
                />
                <div class="DemoToolbarActions DemoToolbarActionsMobile">{toolbarActions()}</div>
              </ScrollArea.Viewport>
            </ScrollArea.Root>
            <div class="DemoToolbarActions DemoToolbarActionsDesktop">{toolbarActions()}</div>
          </div>

          <DemoCodeBlock
            selectedFile={demo.selectedFile()}
            selectedFileLines={demo.selectedFileLines()}
            collapsibleOpen={demo.expanded()}
            collapsibleTriggerRef={(el) => {
              collapsibleTriggerRef = el ?? undefined
            }}
            copyButton={
              <GhostButton
                layout="icon"
                aria-label="Copy code"
                onClick={demo.copy}
                class="DemoCodeBlockCopyButton"
              >
                {copyTimeout() ? <CheckIcon /> : <CopyIcon />}
              </GhostButton>
            }
          />
        </div>
      </Collapsible.Root>
    </div>
  )
}
