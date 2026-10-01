import { For, Show, splitProps, type JSX } from "solid-js"
import clsx from "clsx"
import type { AttributeDef } from "./types"
import * as Table from "../Table"
import * as Accordion from "../Accordion"
import { TableCode } from "../TableCode"

interface AttributesReferenceTableProps extends JSX.HTMLAttributes<HTMLDivElement> {
  data: Record<string, AttributeDef>
  name?: string
}

/** Data-attribute table. Upstream renders both an Accordion (xs) and a Table (>xs)
    version with the same contents, switched via Tailwind `hidden` utility. */
export function AttributesReferenceTable(props: AttributesReferenceTableProps) {
  const [local, rest] = splitProps(props, ["data", "name", "class"])
  const entries = () => Object.entries(local.data)

  return (
    <>
      <Accordion.Root {...(rest as JSX.HTMLAttributes<HTMLElement>)} class={clsx(local.class, "xs:hidden")}>
        <Accordion.HeaderRow>
          <Accordion.HeaderCell class="pl-[0.75rem]">Attribute</Accordion.HeaderCell>
        </Accordion.HeaderRow>
        <For each={entries()}>
          {([name, attribute], index) => (
            <Accordion.Item>
              <Accordion.Trigger index={index()}>
                <TableCode class="text-navy">{name}</TableCode>
                <AccordionChevron />
              </Accordion.Trigger>
              <Accordion.Panel>
                <Accordion.Content class="flex flex-col gap-3 p-4 text-md text-pretty">
                  {attribute.description}
                </Accordion.Content>
              </Accordion.Panel>
            </Accordion.Item>
          )}
        </For>
      </Accordion.Root>

      <Table.Root {...rest} class={clsx("hidden xs:block", local.class)}>
        <Table.Head>
          <Table.Row>
            <Table.ColumnHeader class="w-full xs:w-48 sm:w-56 md:w-[calc(5/16.5*100%)]">
              Attribute
            </Table.ColumnHeader>
            <Table.ColumnHeader class="xs:w-2/3 md:w-[calc(11.5/16.5*100%)]">
              <span class="sr-only xs:not-sr-only xs:contents">Description</span>
            </Table.ColumnHeader>
            <Table.ColumnHeader class="w-10 max-xs:hidden" aria-hidden>
              <span class="invisible">{"-"}</span>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <For each={entries()}>
            {([name, attribute]) => (
              <Table.Row>
                <Table.RowHeader>
                  <TableCode class="text-navy">{name}</TableCode>
                </Table.RowHeader>
                <Table.Cell colspan={2}>
                  <Show when={attribute.description}>{attribute.description}</Show>
                </Table.Cell>
              </Table.Row>
            )}
          </For>
        </Table.Body>
      </Table.Root>
    </>
  )
}

function AccordionChevron() {
  return (
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
  )
}
