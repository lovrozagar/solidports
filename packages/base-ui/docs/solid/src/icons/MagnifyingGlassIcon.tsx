import type { JSX } from "solid-js"

export function MagnifyingGlassIcon(props: JSX.SvgSVGAttributes<SVGSVGElement>) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-linecap="square"
      stroke-linejoin="round"
      {...props}
    >
      <path d="m11 11 3.5 3.5" />
      <circle cx="7" cy="7" r="5.5" />
    </svg>
  )
}
