import { For, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import clsx from "clsx"
import type { CssVariableDef } from "./types"
import * as Table from "../Table"
import * as Accordion from "../Accordion"
import { TableCode } from "../TableCode"

import { splitProps } from '../../utils/solid-1-compat';
interface CssVariablesReferenceTableProps extends JSX.HTMLAttributes<HTMLDivElement> {
  data: Record<string, CssVariableDef>
  name?: string
}

export function CssVariablesReferenceTable(props: CssVariablesReferenceTableProps) {
  const [local, rest] = splitProps(props, ["data", "name", "class"])
  const entries = () => Object.entries(local.data)

  return (
    <>
      <Accordion.Root {...(rest as JSX.HTMLAttributes<HTMLElement>)} class={clsx(local.class, "xs:hidden")}>
        <Accordion.HeaderRow>
          <Accordion.HeaderCell>CSS Variable</Accordion.HeaderCell>
        </Accordion.HeaderRow>
        <For each={entries()}>
          {([name, cssVariable], index) => (
            <Accordion.Item>
              <Accordion.Trigger index={index()}>
                <TableCode class="text-navy">{name}</TableCode>
                <AccordionChevron />
              </Accordion.Trigger>
              <Accordion.Panel>
                <Accordion.Content class="flex flex-col gap-3 p-4 text-md text-pretty">
                  {cssVariable.description}
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
              CSS Variable
            </Table.ColumnHeader>
            <Table.ColumnHeader class="xs:w-2/3 md:w-[calc(11.5/16.5*100%)]">
              <span class="sr-only xs:not-sr-only xs:contents">Description</span>
            </Table.ColumnHeader>
            <Table.ColumnHeader class="w-10 max-xs:hidden" aria-hidden="true">
              <span class="invisible">{"-"}</span>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <For each={entries()}>
            {([name, cssVariable]) => (
              <Table.Row>
                <Table.RowHeader>
                  <TableCode class="text-navy">{name}</TableCode>
                </Table.RowHeader>
                <Table.Cell colspan={2}>
                  <Show when={cssVariable.description}>{cssVariable.description}</Show>
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
