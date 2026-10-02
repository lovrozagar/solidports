import { For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import * as Table from "../Table"
import * as Accordion from "../Accordion"
import { TableCode } from "../TableCode"
import type { PropDef } from "./types"

import { splitProps } from '../../utils/solid-1-compat';
interface ReturnValueReferenceTableProps extends JSX.HTMLAttributes<HTMLDivElement> {
  data: Record<string, PropDef>
  name?: string
}

function getDescription(def: PropDef, name: string, includeName: boolean) {
  const baseDescription = [def.description, def.example].filter(Boolean).join("\n\n")
  if (!includeName) return baseDescription
  const nameLabel = `**${name}**`
  return baseDescription ? `${nameLabel}: ${baseDescription}` : nameLabel
}

export function ReturnValueReferenceTable(props: ReturnValueReferenceTableProps) {
  const [local, rest] = splitProps(props, ["data", "name", "class"])
  const entries = () => Object.entries(local.data)
  const includeName = () => entries().length > 1

  return (
    <>
      <Accordion.Root
        {...(rest as JSX.HTMLAttributes<HTMLElement>)}
        class={clsx(local.class, "xs:hidden")}
      >
        <Accordion.HeaderRow>
          <Accordion.HeaderCell>Type</Accordion.HeaderCell>
        </Accordion.HeaderRow>
        <For each={entries()}>
          {([name, def], index) => {
            const typeValue = def.type ?? def.detailedType
            const descriptionText = getDescription(def, name, includeName())
            return (
              <Accordion.Item>
                <Accordion.Trigger index={index()}>
                  <Show
                    when={typeValue}
                    fallback={<TableCode class="text-(--syntax-nullish)">—</TableCode>}
                  >
                    <TableCode>{typeValue}</TableCode>
                  </Show>
                  <svg
                    class="AccordionIcon ml-auto mr-1"
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M1 3.5L5 7.5L9 3.5" stroke="currentcolor" />
                  </svg>
                </Accordion.Trigger>
                <Accordion.Panel>
                  <Accordion.Content class="flex flex-col gap-3 p-4 text-md text-pretty">
                    <Show
                      when={descriptionText}
                      fallback={<TableCode class="text-(--syntax-nullish)">—</TableCode>}
                    >
                      {descriptionText}
                    </Show>
                  </Accordion.Content>
                </Accordion.Panel>
              </Accordion.Item>
            )
          }}
        </For>
      </Accordion.Root>

      <Table.Root {...rest} class={clsx("hidden xs:block", local.class)}>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader class="xs:w-2/5">Type</Table.ColumnHeader>
            <Table.ColumnHeader class="xs:w-3/5">
              <span class="sr-only xs:not-sr-only xs:contents">Description</span>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <For each={entries()}>
            {([name, def]) => {
              const typeValue = def.type ?? def.detailedType
              const descriptionText = getDescription(def, name, includeName())
              return (
                <Table.Row>
                  <Table.Cell>
                    <Show
                      when={typeValue}
                      fallback={<TableCode class="text-(--syntax-nullish)">—</TableCode>}
                    >
                      <TableCode>{typeValue}</TableCode>
                    </Show>
                  </Table.Cell>
                  <Table.Cell>
                    <Show
                      when={descriptionText}
                      fallback={<TableCode class="text-(--syntax-nullish)">—</TableCode>}
                    >
                      {descriptionText}
                    </Show>
                  </Table.Cell>
                </Table.Row>
              )
            }}
          </For>
        </Table.Body>
      </Table.Root>
    </>
  )
}
