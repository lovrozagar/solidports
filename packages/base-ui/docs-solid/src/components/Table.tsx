import { splitProps, type JSX, type ParentProps } from "solid-js"
import clsx from "clsx"

export function Root(props: JSX.HTMLAttributes<HTMLDivElement> & ParentProps) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <div class={clsx("TableRoot", local.class)} {...rest}>
      <table class="TableRootTable">{local.children}</table>
    </div>
  )
}

export function Head(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <thead class={clsx("TableHead", local.class)} {...rest} />
}

export function Body(props: JSX.HTMLAttributes<HTMLTableSectionElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <tbody class={clsx("TableBody", local.class)} {...rest} />
}

export function Row(props: JSX.HTMLAttributes<HTMLTableRowElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <tr class={clsx("TableRow", local.class)} {...rest} />
}

export function ColumnHeader(props: JSX.ThHTMLAttributes<HTMLTableCellElement>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <th scope="col" class={clsx("TableColumnHeader", local.class)} {...rest}>
      <span class="TableCellInner">{local.children}</span>
    </th>
  )
}

export function RowHeader(props: JSX.ThHTMLAttributes<HTMLTableCellElement>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <th scope="row" class={clsx("TableCell", local.class)} {...rest}>
      <span class="TableCellInner">{local.children}</span>
    </th>
  )
}

export function Cell(props: JSX.TdHTMLAttributes<HTMLTableCellElement>) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <td class={clsx("TableCell", local.class)} {...rest}>
      <span class="TableCellInner">{local.children}</span>
    </td>
  )
}
