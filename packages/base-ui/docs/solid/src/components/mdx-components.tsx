import type { ParentProps } from 'solid-js';
import type { JSX } from '@solidjs/web';
import "../css/mdx-components.css"
import * as CodeBlock from "./CodeBlock"
import * as Table from "./Table"
import * as QuickNav from "./QuickNav"
import { Code } from "./Code"
import { ReferenceAccordion } from "./ReferenceTable/ReferenceAccordion"
import { ParametersReferenceTable } from "./ReferenceTable/ParametersReferenceTable"
import { ReturnValueReferenceTable } from "./ReferenceTable/ReturnValueReferenceTable"
import { AttributesReferenceTable } from "./ReferenceTable/AttributesReferenceTable"
import { CssVariablesReferenceTable } from "./ReferenceTable/CssVariablesReferenceTable"
import { Link } from "./Link"
import { HeadingLink } from "./HeadingLink"
import { Subtitle } from "./Subtitle/Subtitle"
import { Kbd } from "./Kbd/Kbd"
import { Demo } from "./Demo"
import { Callout } from "./Callout"
import { PropTable } from "./PropTable"
import clsx from "clsx"

import { splitProps } from '../utils/solid-1-compat';
/* eslint-disable @typescript-eslint/no-explicit-any */
interface MDXComponents {
  [key: string]: ((props: any) => JSX.Element) | MDXComponents
}

/* Inline-data `<PropsReferenceTable>` — upstream emits via rehypeReference for hook
   param/return tables. Routes through `ReferenceAccordion` which handles prop tables. */
function PropsReferenceTable(props: Parameters<typeof ReferenceAccordion>[0]) {
  const [local, rest] = splitProps(props, ["class"])
  return <ReferenceAccordion class={clsx("MdReferenceBlock", local.class)} {...rest} />
}

/* Upstream: `h1`/`h2`/`h3` render via <HeadingLink> when id present. */
function H1(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <h1 class={clsx("MdH1", local.class)} {...rest} />
}

function H2(props: ParentProps<JSX.HTMLAttributes<HTMLHeadingElement>>) {
  const [local, rest] = splitProps(props, ["children", "id", "class"])
  return (
    <h2 class={clsx("MdH2", local.class)} id={local.id} {...rest}>
      <HeadingLink id={local.id}>{local.children}</HeadingLink>
    </h2>
  )
}

function H3(props: ParentProps<JSX.HTMLAttributes<HTMLHeadingElement>>) {
  const [local, rest] = splitProps(props, ["children", "id", "class"])
  return (
    <h3 class={clsx("MdH3", local.class)} id={local.id} {...rest}>
      <HeadingLink id={local.id}>{local.children}</HeadingLink>
    </h3>
  )
}

function H4(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <h4 class={clsx("MdH4", local.class)} {...rest} />
}

function H5(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <h5 class={clsx("MdH5", local.class)} {...rest} />
}

function H6(props: JSX.HTMLAttributes<HTMLHeadingElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <h6 class={clsx("MdH6", local.class)} {...rest} />
}

function P(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <p class={clsx("MdP", local.class)} {...rest} />
}

function Li(props: JSX.LiHTMLAttributes<HTMLLIElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <li class={clsx("MdListItem", local.class)} {...rest} />
}

function Ul(props: JSX.HTMLAttributes<HTMLUListElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <ul class={clsx("MdUl", local.class)} {...rest} />
}

function Ol(props: JSX.OlHTMLAttributes<HTMLOListElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <ol class={clsx("MdOl", local.class)} {...rest} />
}

function Em(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <em class={clsx("MdEm", local.class)} {...rest} />
}

/* Figure toggles between CodeBlock.Root and plain figure based on
   rehype-pretty-code's marker attribute — upstream parity. */
function Figure(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  if ("data-rehype-pretty-code-figure" in props) {
    return (
      <CodeBlock.Root
        class={clsx("MdFigure", local.class)}
        {...(rest as JSX.HTMLAttributes<HTMLDivElement>)}
      />
    )
  }
  return <figure class={clsx("MdFigure", local.class)} {...rest} />
}

function Figcaption(props: JSX.HTMLAttributes<HTMLElement>) {
  if ("data-rehype-pretty-code-title" in props) {
    return <CodeBlock.Panel {...(props as ParentProps<JSX.HTMLAttributes<HTMLDivElement>>)} />
  }
  return <figcaption {...props} />
}

/* Shiki emits tabindex={0} on <pre> — modern scroll containers handle focus natively,
   so we strip it to avoid double focus stops. */
function Pre(props: JSX.HTMLAttributes<HTMLPreElement> & { tabIndex?: number }) {
  const [, rest] = splitProps(props, ["tabindex"])
  return <CodeBlock.Pre {...rest} />
}

function TableRoot(props: JSX.HTMLAttributes<HTMLDivElement>) {
  const [local, rest] = splitProps(props, ["class"])
  return <Table.Root class={clsx("MdTable", local.class)} {...rest} />
}

function Th(props: JSX.ThHTMLAttributes<HTMLTableCellElement>) {
  return props.scope === "row" ? <Table.RowHeader {...props} /> : <Table.ColumnHeader {...props} />
}

function CodeInline(props: JSX.HTMLAttributes<HTMLElement>) {
  const [local, rest] = splitProps(props, ["class"])
  if (!("data-inline" in props)) {
    return <code class={local.class} {...rest} />
  }
  return <Code class={clsx("MdCode", local.class)} {...rest} />
}

function MetaTag(props: JSX.HTMLAttributes<HTMLMetaElement> & { name?: string; content?: string }) {
  if (props.name === "description" && String(props.content).length > 170) {
    throw new Error("Meta description shouldn't be longer than 170 chars")
  }
  /* React docs drop <Meta> at render time. Leaving the tag in the body breaks
     `.Subtitle + .MdH2` and shifts every section down. */
  return null
}

function SubtitleWrapped(props: JSX.HTMLAttributes<HTMLParagraphElement>) {
  return <Subtitle {...props} />
}

function AttributesReferenceTableWrapped(props: Parameters<typeof AttributesReferenceTable>[0]) {
  const [local, rest] = splitProps(props, ["class"])
  return <AttributesReferenceTable class={clsx("MdReferenceBlock", local.class)} {...rest} />
}

function CssVariablesReferenceTableWrapped(props: Parameters<typeof CssVariablesReferenceTable>[0]) {
  const [local, rest] = splitProps(props, ["class"])
  return <CssVariablesReferenceTable class={clsx("MdReferenceBlock", local.class)} {...rest} />
}

function ParametersReferenceTableWrapped(props: Parameters<typeof ParametersReferenceTable>[0]) {
  const [local, rest] = splitProps(props, ["class"])
  return <ParametersReferenceTable class={clsx("MdReferenceBlock", local.class)} {...rest} />
}

function ReturnValueReferenceTableWrapped(props: Parameters<typeof ReturnValueReferenceTable>[0]) {
  const [local, rest] = splitProps(props, ["class"])
  return <ReturnValueReferenceTable class={clsx("MdReferenceBlock", local.class)} {...rest} />
}

/* Legacy `<Reference component="X" parts="A,B">` shortcode — routes through PropTable
   until every MDX call site migrates to the inline-data ReferenceAccordion shape. */
function Reference(props: { component?: string; parts?: string }) {
  return <PropTable component={props.component} parts={props.parts} />
}

/* MDX shortcode registry — upstream parity: every key MUST resolve to a defined
   component, otherwise solid-mdx throws `Comp is not a function` at render. */
export const mdxComponents: MDXComponents = {
  a: Link as unknown as (props: any) => JSX.Element,
  em: Em,
  code: CodeInline,
  h1: H1,
  h2: H2,
  h3: H3,
  h4: H4,
  h5: H5,
  h6: H6,
  p: P,
  li: Li,
  ul: Ul,
  ol: Ol,
  kbd: Kbd,
  figure: Figure,
  figcaption: Figcaption,
  pre: Pre,
  table: TableRoot,
  thead: Table.Head,
  tbody: Table.Body,
  tr: Table.Row,
  th: Th,
  td: Table.Cell,

  QuickNav: QuickNav as unknown as MDXComponents,
  Meta: MetaTag,
  Subtitle: SubtitleWrapped,
  Demo,
  Callout,

  AttributesReferenceTable: AttributesReferenceTableWrapped,
  CssVariablesReferenceTable: CssVariablesReferenceTableWrapped,
  PropsReferenceTable,
  ParametersReferenceTable: ParametersReferenceTableWrapped,
  ReturnValueReferenceTable: ReturnValueReferenceTableWrapped,
  ReferenceAccordion,
  Reference,
}

export const inlineMdxComponents: MDXComponents = {
  ...mdxComponents,
  p: (props: ParentProps) => props.children,
}

export function useMDXComponents(): MDXComponents {
  return mdxComponents
}
