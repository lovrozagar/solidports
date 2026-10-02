import { createSignal, Errored, onSettled, Show, Loading } from 'solid-js';
import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
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
  onSettled(() => {
    setMounted(true)
  })

  return (
    <Errored
      fallback={(err, reset) => (
        <DemoErrorFallback error={typeof err === "function" ? err() : err} reset={reset} />
      )}
    >
      <div class="DemoPlayground">
        <div
          aria-label="Component demo"
          data-demo={kebabCase(props.variant)}
          class="DemoPlaygroundInner"
        >
          <Show when={mounted()}>
            <Loading fallback={null}>{props.component}</Loading>
          </Show>
        </div>
        {props.children}
      </div>
    </Errored>
  )
}
