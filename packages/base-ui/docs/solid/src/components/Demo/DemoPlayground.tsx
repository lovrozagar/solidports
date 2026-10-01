import { createSignal, ErrorBoundary, onMount, Show, Suspense, type JSX, type ParentProps } from "solid-js"
import { DemoErrorFallback } from "./DemoErrorFallback"

function kebabCase(value?: string) {
  if (!value) return ""
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase()
}

export interface DemoPlaygroundProps extends ParentProps {
  component: JSX.Element
  variant?: string
}

/* Demos render client-only. Base UI primitives (Toast/Combobox Portal, Floating UI portal node) touch `document` at component body —
   explodes under SSR. Upstream React uses 'use client'; Solid has no equivalent, so gate render until after hydration. */
export function DemoPlayground(props: DemoPlaygroundProps) {
  const [mounted, setMounted] = createSignal(false)
  onMount(() => setMounted(true))

  return (
    <ErrorBoundary fallback={(err, reset) => <DemoErrorFallback error={err} reset={reset} />}>
      <div class="DemoPlayground">
        <div
          aria-label="Component demo"
          data-demo={kebabCase(props.variant)}
          class="DemoPlaygroundInner"
        >
          <Show when={mounted()}>
            <Suspense fallback={null}>{props.component}</Suspense>
          </Show>
        </div>
        {props.children}
      </div>
    </ErrorBoundary>
  )
}
