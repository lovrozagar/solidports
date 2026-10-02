import { createMemo, For, Show, Loading } from 'solid-js';
import type { Component } from 'solid-js';
interface PropDef {
  type?: string
  default?: string
  required?: boolean
  description?: string
  detailedType?: string
}

interface AttributeDef {
  type?: string
  description?: string
}

interface CssVariableDef {
  type?: string
  description?: string
}

interface ComponentDef {
  name: string
  description?: string
  props?: Record<string, PropDef>
  dataAttributes?: Record<string, AttributeDef>
  cssVariables?: Record<string, CssVariableDef>
}

interface FunctionDef {
  name: string
  description?: string
  parameters?: Record<string, PropDef>
  returnValue?: Record<string, PropDef> | PropDef | string
}

type ReferenceDef = ComponentDef | FunctionDef

const referenceModules = import.meta.glob<ReferenceDef>("../reference/*.json", { import: "default" })

/* Upstream uses kebab-case filenames: `dialog-root.json`, `combobox-trigger.json`, `use-render.json`. */
function kebabCase(input: string): string {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[_\s]+/g, "-")
    .toLowerCase()
}

function buildFilename(component: string, part?: string): string {
  if (part) {
    const combined = `${kebabCase(component)}-${kebabCase(part)}.json`
    return `../reference/${combined}`
  }
  return `../reference/${kebabCase(component)}.json`
}

async function loadReference(path: string): Promise<ReferenceDef | null> {
  const loader = referenceModules[path]
  if (!loader) return null
  try {
    return await loader()
  } catch {
    return null
  }
}

interface PropTableProps {
  component?: string
  parts?: string
}

/** Renders a prop table for a Base UI component or hook from upstream reference JSON. */
export function PropTable(props: PropTableProps) {
  const partList = () => (props.parts ? props.parts.split(/,\s*/) : [""])

  return (
    <Show
      when={props.component}
      fallback={<div class="PropTableEmpty">Missing component name.</div>}
    >
      <For each={partList()}>
        {(part) => <PropTableSection component={props.component!} part={part} />}
      </For>
    </Show>
  )
}

function PropTableSection(props: { component: string; part: string }) {
  const def = createMemo(() =>
    loadReference(buildFilename(props.component, props.part || undefined)),
  )

  return (
    <Loading fallback={<div class="PropTableLoading">Loading API…</div>}>
      <Show
        when={def()}
        fallback={
          <div class="PropTablePlaceholder">
            API reference for <code>{props.component}{props.part ? `.${props.part}` : ""}</code> not available.
          </div>
        }
      >
        {(definition) => <ReferenceRenderer def={definition()} showHeading={Boolean(props.part)} />}
      </Show>
    </Loading>
  )
}

function isFunctionDef(def: ReferenceDef): def is FunctionDef {
  return "parameters" in def || "returnValue" in def
}

const ReferenceRenderer: Component<{ def: ReferenceDef; showHeading: boolean }> = (props) => {
  return (
    <div class="PropTable">
      <Show when={props.showHeading}>
        <h3 class="PropTableHeading">{props.def.name}</h3>
      </Show>
      <Show when={props.def.description}>
        <p class="PropTableDescription">{props.def.description}</p>
      </Show>

      <Show when={isFunctionDef(props.def) && props.def}>
        {(fn) => <FunctionRenderer def={fn() as FunctionDef} />}
      </Show>

      <Show when={!isFunctionDef(props.def) && props.def}>
        {(comp) => <ComponentRenderer def={comp() as ComponentDef} />}
      </Show>
    </div>
  )
}

function ComponentRenderer(props: { def: ComponentDef }) {
  const propEntries = () => Object.entries(props.def.props ?? {})
  const attrEntries = () => Object.entries(props.def.dataAttributes ?? {})
  const cssEntries = () => Object.entries(props.def.cssVariables ?? {})

  return (
    <>
      <Show when={propEntries().length > 0}>
        <table class="PropTableTable">
          <thead>
            <tr>
              <th>Prop</th>
              <th>Type</th>
              <th>Default</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <For each={propEntries()}>
              {([name, def]) => (
                <tr>
                  <td>
                    <code>{name}</code>
                    <Show when={def.required}>
                      <span class="PropTableRequired"> *</span>
                    </Show>
                  </td>
                  <td>
                    <code>{def.type}</code>
                  </td>
                  <td>
                    <Show when={def.default} fallback={<span class="PropTableMuted">—</span>}>
                      <code>{def.default}</code>
                    </Show>
                  </td>
                  <td>{def.description}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <Show when={attrEntries().length > 0}>
        <h4 class="PropTableSubheading">Data attributes</h4>
        <table class="PropTableTable">
          <thead>
            <tr>
              <th>Attribute</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <For each={attrEntries()}>
              {([name, def]) => (
                <tr>
                  <td>
                    <code>{name}</code>
                  </td>
                  <td>
                    <code>{def.type}</code>
                  </td>
                  <td>{def.description}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <Show when={cssEntries().length > 0}>
        <h4 class="PropTableSubheading">CSS variables</h4>
        <table class="PropTableTable">
          <thead>
            <tr>
              <th>Variable</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <For each={cssEntries()}>
              {([name, def]) => (
                <tr>
                  <td>
                    <code>{name}</code>
                  </td>
                  <td>
                    <code>{def.type}</code>
                  </td>
                  <td>{def.description}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>
    </>
  )
}

function FunctionRenderer(props: { def: FunctionDef }) {
  const paramEntries = () => Object.entries(props.def.parameters ?? {})

  const returnEntries = () => {
    const rv = props.def.returnValue
    if (!rv || typeof rv === "string") return []
    if ("type" in rv || "description" in rv) return [["", rv as PropDef]] as const
    return Object.entries(rv as Record<string, PropDef>)
  }

  return (
    <>
      <Show when={paramEntries().length > 0}>
        <h4 class="PropTableSubheading">Parameters</h4>
        <table class="PropTableTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <For each={paramEntries()}>
              {([name, def]) => (
                <tr>
                  <td>
                    <code>{name}</code>
                  </td>
                  <td>
                    <code>{def.type}</code>
                  </td>
                  <td>{def.description}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <Show when={returnEntries().length > 0}>
        <h4 class="PropTableSubheading">Return value</h4>
        <table class="PropTableTable">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <For each={returnEntries()}>
              {([name, def]) => (
                <tr>
                  <td>
                    <code>{name || "return"}</code>
                  </td>
                  <td>
                    <code>{def.type}</code>
                  </td>
                  <td>{def.description}</td>
                </tr>
              )}
            </For>
          </tbody>
        </table>
      </Show>

      <Show when={typeof props.def.returnValue === "string"}>
        <h4 class="PropTableSubheading">Return value</h4>
        <p>
          <code>{props.def.returnValue as string}</code>
        </p>
      </Show>
    </>
  )
}
