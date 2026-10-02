import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import { Link } from "../Link"
import * as CodeBlock from "../CodeBlock"
import * as Accordion from "../Accordion"
import { highlightInline } from "../../syntax-highlighting/highlight"
import * as DescriptionList from "../DescriptionList"
import type { PropDef as BasePropDef } from "./types"
import { TableCode } from "../TableCode"
import * as ReferenceTableTooltip from "./ReferenceTableTooltip"
import { sortPropEntries } from "./propOrder"

import { splitProps } from '../../utils/solid-1-compat';
/* Tooltip.Portal crashes hydration with `template2 is not a function` — the portal
   moves subtree to body, so SSR markers don't line up with client. Gate the tooltip
   render to post-mount; SSR + initial hydrate emit plain <TableCode> (matches across
   boundaries), then the tooltip lights up after mount. */
function TypeCell(props: {
  detailedDisplayType: string | undefined
  displayType: string | undefined
  shortPropTypeName: string | undefined
  hasExpandedType: boolean
  showTooltip: boolean
}) {
  const [mounted, setMounted] = createSignal(false)
  onSettled(() => {
    setMounted(true)
  })
  return (
    <Show when={mounted() && props.showTooltip} fallback={<TableCode>{props.shortPropTypeName}</TableCode>}>
      <ReferenceTableTooltip.Root disableHoverablePopup>
        <ReferenceTableTooltip.Trigger delay={300}>
          <TableCode>{props.shortPropTypeName}</TableCode>
        </ReferenceTableTooltip.Trigger>
        <ReferenceTableTooltip.Popup>
          <TableCode>{props.hasExpandedType ? props.detailedDisplayType : props.displayType}</TableCode>
        </ReferenceTableTooltip.Popup>
      </ReferenceTableTooltip.Root>
    </Show>
  )
}

interface PropDef extends BasePropDef {
  detailedType?: string
  example?: string
}

interface Props extends JSX.HTMLAttributes<HTMLElement> {
  data: Record<string, PropDef>
  type?: "props" | "return"
  name: string
  renameFrom?: string
  renameTo?: string
  nameLabel?: string
  caption?: string
}

function InlineDescription(props: { text: string }) {
  const parts = () => props.text.split(/(`[^`]+`)/g)
  return (
    <For each={parts()}>
      {(part) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code class="Code MdCode" data-inline>
            {part.slice(1, -1)}
          </code>
        ) : (
          part.replace(/\s*\n+\s*/g, " ")
        )
      }
    </For>
  )
}

function getShortPropType(name: string, type: string | undefined) {
  if (/^(on|get)[A-Z].*/.test(name)) return { type: "function", detailedType: true }
  if (type === undefined || type === null) return { type: String(type), detailedType: false }
  if (name === "class") return { type: "string | function", detailedType: true }
  if (name === "style") return { type: "CSSProperties | function", detailedType: true }
  if (name === "render") return { type: "JSX.Element | function", detailedType: true }

  if (
    name.endsWith("Ref") ||
    name === "children" ||
    type === "boolean" ||
    type === "string" ||
    type === "number" ||
    type.indexOf(" | ") === -1 ||
    (type.split("|").length < 3 && type.length < 30)
  ) {
    return { type, detailedType: false }
  }

  return { type: "Union", detailedType: true }
}

function escapeRegExp(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function replaceComponentPrefix(input: string | undefined, from?: string, to?: string) {
  if (!input || !from || !to) return input ?? ""
  const pattern = new RegExp(`\\b${escapeRegExp(from)}(?=\\.)`, "g")
  return input.replace(pattern, to)
}

const visuallyHidden: JSX.CSSProperties = {
  border: 0,
  clip: "rect(0 0 0 0)",
  height: "1px",
  margin: "-1px",
  overflow: "hidden",
  padding: 0,
  position: "absolute",
  "white-space": "nowrap",
  width: "1px",
}

/** Prop reference accordion. Each row is a `<details>` with the prop name, short
    type, and default in the trigger, full description/type/default/example
    inside. Upstream's async `createMdxComponent` calls for rendering MDX-escaped
    types + descriptions are replaced with plain text until Wave V3 lands the
    Solid MDX renderer. */
export function ReferenceAccordion(props: Props) {
  const [local, rest] = splitProps(props, [
    "data",
    "name",
    "renameFrom",
    "renameTo",
    "nameLabel",
    "caption",
    "class",
    "style",
  ])
  const captionId = () => `${local.name}-caption`
  const nameLabel = () => local.nameLabel ?? "Prop"
  const caption = () => local.caption ?? "Component props table"
  const entries = createMemo(() =>
    nameLabel() === "Prop" ? sortPropEntries(local.data) : Object.entries(local.data),
  )
  const rowsStyle = createMemo((): JSX.CSSProperties => ({
    "--rows": String(Object.keys(local.data).length),
    ...(typeof local.style === "object" && local.style ? local.style : {}),
  }))

  return (
    <Accordion.Root
      aria-describedby={captionId()}
      {...rest}
      class={clsx("ReferenceAccordionRoot", local.class)}
      style={rowsStyle()}
    >
      <span id={captionId()} style={visuallyHidden} aria-hidden="true">
        {caption()}
      </span>
      <Accordion.HeaderRow class="ReferenceHeaderRow">
        <Accordion.HeaderCell>{nameLabel()}</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderTypeCell">Type</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderDefaultCell">Default</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      <For each={entries()}>
        {([name, prop], index) => {
          const displayType = replaceComponentPrefix(prop.type, local.renameFrom, local.renameTo)
          const detailedDisplayType = replaceComponentPrefix(
            prop.detailedType ?? prop.type,
            local.renameFrom,
            local.renameTo,
          )
          const { type: shortPropTypeName, detailedType } = getShortPropType(name, displayType)
          const hasExpandedType = Boolean(prop.detailedType)
          const id = `${local.name}-${name}`

          return (
            <Accordion.Item>
              <Accordion.Trigger
                id={id}
                index={index()}
                aria-label={`${nameLabel()}: ${name},${prop.required ? " required," : ""} type: ${shortPropTypeName} ${prop.default !== undefined ? `(default: ${prop.default})` : ""}`}
                class="ReferenceTrigger"
              >
                <Accordion.Scrollable class="ReferenceNameCell">
                  <TableCode class="bui-ws-nw" style={{ color: "var(--color-navy)" }}>
                    {name}
                  </TableCode>
                  <sup
                    class="ReferenceRequired"
                    style={{ display: prop.required ? "inline" : "none" }}
                  >
                    *
                  </sup>
                </Accordion.Scrollable>
                <Show when={prop.type}>
                  <Accordion.Scrollable class="ReferenceTypeCell">
                    <TypeCell
                      detailedDisplayType={detailedDisplayType}
                      displayType={displayType}
                      shortPropTypeName={shortPropTypeName}
                      hasExpandedType={hasExpandedType}
                      showTooltip={hasExpandedType || detailedType}
                    />
                  </Accordion.Scrollable>
                </Show>
                <Accordion.Scrollable class="ReferenceDefaultCell">
                  <Show
                    when={!(prop.required || prop.default === undefined)}
                    fallback={<TableCode style={{ color: "var(--color-docs-infra-syntax-nullish)" }}>—</TableCode>}
                  >
                    <TableCode>{prop.default}</TableCode>
                  </Show>
                </Accordion.Scrollable>
                <span class="ReferenceIconWrap">
                  <svg
                    class="AccordionIcon ReferenceIcon"
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M1 3.5L5 7.5L9 3.5" stroke="currentcolor" />
                  </svg>
                </span>
              </Accordion.Trigger>
              <Accordion.Panel>
                <Accordion.Content>
                  <DescriptionList.Root class="ReferenceContent" aria-label="Info">
                    <DescriptionList.Item>
                      <DescriptionList.Term>Name</DescriptionList.Term>
                      <DescriptionList.Details>
                        <Link href={`#${id}`}>
                          <TableCode class="text-(--color-blue)">{name}</TableCode>
                        </Link>
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                    <Show when={prop.description}>
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Description</DescriptionList.Term>
                        <DescriptionList.Details class="ReferenceDescription">
                          <InlineDescription text={prop.description ?? ""} />
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Type</DescriptionList.Term>
                      <DescriptionList.Details>
                        <CodeBlock.Root>
                          <code innerHTML={highlightInline(detailedDisplayType, "tsx")} />
                        </CodeBlock.Root>
                      </DescriptionList.Details>
                    </DescriptionList.Item>
                    <Show when={prop.default !== undefined}>
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Default</DescriptionList.Term>
                        <DescriptionList.Details>
                          <TableCode>{prop.default}</TableCode>
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                    <Show when={prop.example}>
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Example</DescriptionList.Term>
                        <DescriptionList.Details class="ReferenceExampleReset">
                          <TableCode>{prop.example}</TableCode>
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                  </DescriptionList.Root>
                </Accordion.Content>
              </Accordion.Panel>
            </Accordion.Item>
          )
        }}
      </For>
    </Accordion.Root>
  )
}
