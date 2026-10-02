import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { splitProps } from '../utils/solid-1-compat';
import clsx from "clsx"

export function Root(props: JSX.HTMLAttributes<HTMLDListElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <dl class={clsx("DescriptionList", local.class)} {...rest} />
}

export function Term(props: JSX.HTMLAttributes<HTMLElement> & { separator?: boolean } & ParentProps) {
  const [local, rest] = splitProps(props, ["class", "separator", "children"])
  return (
    <dt class={clsx("DescriptionTerm", local.separator && "separator", local.class)} {...rest}>
      <Inner>{local.children}</Inner>
    </dt>
  )
}

export function Details(props: JSX.HTMLAttributes<HTMLElement> & ParentProps) {
  const [local, rest] = splitProps(props, ["class", "children"])
  return (
    <dd class={clsx("DescriptionListDetails", local.class)} {...rest}>
      <Inner>{local.children}</Inner>
    </dd>
  )
}

export function Item(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("DescriptionListItem", local.class)} {...rest} />
}

function Inner(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <div class={clsx("DescriptionListInner", local.class)} {...rest} />
}
