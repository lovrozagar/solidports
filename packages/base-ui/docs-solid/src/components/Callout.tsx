import type { ParentProps } from "solid-js"

type CalloutType = "note" | "warning" | "tip" | "danger"

interface CalloutProps extends ParentProps {
  type?: CalloutType
}

/** Highlighted callout block for MDX prose — note/warning/tip/danger variants. */
export function Callout(props: CalloutProps) {
  const type = () => props.type ?? "note"
  return (
    <div class={`Callout Callout--${type()}`} data-type={type()}>
      {props.children}
    </div>
  )
}
