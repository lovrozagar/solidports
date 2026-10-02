import { Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import { highlightInline } from "../syntax-highlighting/highlight"

import { splitProps } from '../utils/solid-1-compat';
export interface TableCodeProps extends JSX.HTMLAttributes<HTMLElement> {
  printWidth?: number
  lang?: string
}

/* Inline <code> inside reference tables. String children route through shiki
   to match upstream prop-table coloring; JSX children (prop name + required
   asterisk) fall back to plain rendering. Renders <code> directly so the
   `innerHTML` path isn't hidden behind <Code>'s spread. */
export function TableCode(props: TableCodeProps) {
  const [local, rest] = splitProps(props, ["class", "children", "lang", "printWidth"])
  const highlighted = () => {
    const c = local.children
    return typeof c === "string" && c.length > 0
      ? highlightInline(c, local.lang ?? "tsx")
      : null
  }

  return (
    <Show
      when={highlighted()}
      fallback={
        <code
          {...rest}
          data-table-code=""
          data-inline=""
          class={clsx("Code text-xs", local.class)}
        >
          {local.children}
        </code>
      }
    >
      {(html) => (
        <code
          {...rest}
          data-table-code=""
          data-inline=""
          class={clsx("Code text-xs", local.class)}
          innerHTML={html()}
        />
      )}
    </Show>
  )
}
