import { createMemo, For, omit } from 'solid-js';
import { reactStyle } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import type { EnhancedEnumMember } from '@mui/internal-docs-infra/useTypes';
import * as Table from '../Table';
import * as Accordion from '../Accordion';
import { TableCode } from '../TableCode';

interface AttributesReferenceTableProps extends ReactProps<ComponentProps<typeof Table.Root>> {
  data: Record<string, EnhancedEnumMember>;
  name?: string;
}
export function AttributesReferenceTable(props: AttributesReferenceTableProps) {
  const rest = omit(props, 'data', 'name');
  // Lets CSS compute the minimum closed height for `contain-intrinsic-height`;
  // wrapped row content may be taller.
  const rowsStyle = createMemo(
    () =>
      ({
        '--rows': Object.keys(props.data).length,
        ...rest.style,
      }) as JSX.CSSProperties,
  );
  return (
    <>
      <Accordion.Root
        {...rest}
        class={clsx('ReferenceAccordionRoot', 'bp0:bui-d-n', rest.class)}
        style={reactStyle(rowsStyle())}
      >
        <Accordion.HeaderRow>
          <Accordion.HeaderCell>Attribute</Accordion.HeaderCell>
        </Accordion.HeaderRow>
        <For each={Object.keys(props.data)}>
          {(name) => {
            const _row = createMemo(() => {
              const attribute = props.data[name];
              return (
                <Accordion.Item
                  gaCategory="reference"
                  gaLabel={`Attribute: ${props.name ? `${props.name}-` : ''}${name}`}
                  gaParams={{
                    type: 'attribute',
                    slug: `${props.name ? `${props.name}-` : ''}${name}`,
                    part_name: props.name || '',
                  }}
                >
                  <Accordion.Trigger>
                    <TableCode
                      style={{
                        color: 'var(--color-navy)',
                      }}
                    >
                      {name}
                    </TableCode>
                    <svg
                      class="AccordionIcon bui-ml-a bui-mr-1"
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" />
                    </svg>
                  </Accordion.Trigger>
                  <Accordion.Panel>
                    <Accordion.Content class="ReferenceCompactPanel">
                      {attribute.description}
                    </Accordion.Content>
                  </Accordion.Panel>
                </Accordion.Item>
              );
            });
            return <>{_row()}</>;
          }}
        </For>
      </Accordion.Root>
      <Table.Root
        {...rest}
        class={clsx('ReferenceTableRoot', 'bui-d-n', 'bp0:bui-d-b', rest.class)}
        style={reactStyle(rowsStyle())}
      >
        <Table.Head>
          <Table.Row>
            {/* widths must match the props table grid layout */}
            <Table.ColumnHeader class="ReferenceWideNameColumn">Attribute</Table.ColumnHeader>
            <Table.ColumnHeader class="ReferenceWideDescriptionColumn">
              Description
            </Table.ColumnHeader>
            {/* A cell to maintain a layout consistent with the props table */}
            <Table.ColumnHeader class="bui-w-10" aria-hidden="true">
              <span class="bui-v-h">{'-'}</span>
            </Table.ColumnHeader>
          </Table.Row>
        </Table.Head>
        <Table.Body>
          <For each={Object.keys(props.data)}>
            {(name) => {
              const _row2 = createMemo(() => {
                const attribute = props.data[name];
                return (
                  <Table.Row>
                    <Table.RowHeader>
                      <TableCode
                        class="bui-ws-nw"
                        style={{
                          color: 'var(--color-navy)',
                        }}
                      >
                        {name}
                      </TableCode>
                    </Table.RowHeader>
                    <Table.Cell colspan={2}>{attribute.description}</Table.Cell>
                  </Table.Row>
                );
              });
              return <>{_row2()}</>;
            }}
          </For>
        </Table.Body>
      </Table.Root>
    </>
  );
}
