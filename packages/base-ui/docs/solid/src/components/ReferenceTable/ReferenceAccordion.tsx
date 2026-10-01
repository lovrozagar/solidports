import { createSignal, For, onMount, Show, splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import { Link } from "../Link"
import * as Accordion from "../Accordion"
import * as DescriptionList from "../DescriptionList"
import type { PropDef as BasePropDef } from "./types"
import { TableCode } from "../TableCode"
import * as ReferenceTableTooltip from "./ReferenceTableTooltip"

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
  onMount(() => setMounted(true))
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

const TRIGGER_GRID_LAYOUT =
  "xs:grid " +
  "xs:grid-cols-[theme(spacing.48)_1fr_theme(spacing.10)] " +
  "sm:grid-cols-[theme(spacing.56)_1fr_theme(spacing.10)] " +
  "md:grid-cols-[5fr_7fr_4.5fr_theme(spacing.10)] "

const PANEL_GRID_LAYOUT =
  "max-xs:flex max-xs:flex-col " +
  "min-xs:gap-0 " +
  "xs:grid-cols-[theme(spacing.48)_1fr_theme(spacing.10)] " +
  "sm:grid-cols-[theme(spacing.56)_1fr_theme(spacing.10)] " +
  "md:grid-cols-[5fr_11.5fr_theme(spacing.10)] "

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
  ])
  const captionId = () => `${local.name}-caption`
  const nameLabel = () => local.nameLabel ?? "Prop"
  const caption = () => local.caption ?? "Component props table"
  const entries = () => Object.entries(local.data)

  return (
    <Accordion.Root aria-describedby={captionId()} {...rest}>
      <span id={captionId()} style={visuallyHidden} aria-hidden>
        {caption()}
      </span>
      <Accordion.HeaderRow class={clsx("grid", TRIGGER_GRID_LAYOUT)}>
        <Accordion.HeaderCell>{nameLabel()}</Accordion.HeaderCell>
        <Accordion.HeaderCell class="max-xs:hidden">Type</Accordion.HeaderCell>
        <Accordion.HeaderCell class="max-md:hidden">Default</Accordion.HeaderCell>
        <Accordion.HeaderCell class="max-md:hidden w-10" />
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
                class={clsx("min-h-min scroll-mt-12 p-0 md:scroll-mt-0", TRIGGER_GRID_LAYOUT)}
              >
                <Accordion.Scrollable class="px-3">
                  <TableCode class="text-navy whitespace-nowrap">{name}</TableCode>
                  {prop.required ? (
                    <sup class="top-[-0.3em] text-xs text-red-800">*</sup>
                  ) : null}
                </Accordion.Scrollable>
                <Show when={prop.type}>
                  <Accordion.Scrollable class="px-3 flex items-baseline text-sm leading-none break-keep whitespace-nowrap max-xs:hidden">
                    <TypeCell
                      detailedDisplayType={detailedDisplayType}
                      displayType={displayType}
                      shortPropTypeName={shortPropTypeName}
                      hasExpandedType={hasExpandedType}
                      showTooltip={hasExpandedType || detailedType}
                    />
                  </Accordion.Scrollable>
                </Show>
                <Accordion.Scrollable class="max-md:hidden break-keep whitespace-nowrap px-3">
                  <Show
                    when={!(prop.required || prop.default === undefined)}
                    fallback={<TableCode class="text-(--syntax-nullish)">—</TableCode>}
                  >
                    <TableCode>{prop.default}</TableCode>
                  </Show>
                </Accordion.Scrollable>
                <span class="flex justify-center max-xs:ml-auto max-xs:mr-3">
                  <svg
                    class="AccordionIcon translate-y-px"
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
                  <DescriptionList.Root
                    class={clsx("text-gray-600 max-xs:py-3", PANEL_GRID_LAYOUT)}
                    aria-label="Info"
                  >
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
                        <DescriptionList.Details class="[&_[role='figure']]:mt-1 [&_[role='figure']]:mb-1">
                          {prop.description}
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                    </Show>
                    <DescriptionList.Item>
                      <DescriptionList.Term separator>Type</DescriptionList.Term>
                      <DescriptionList.Details>
                        <TableCode>{detailedDisplayType}</TableCode>
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
                        <DescriptionList.Details class="*:my-0">
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
