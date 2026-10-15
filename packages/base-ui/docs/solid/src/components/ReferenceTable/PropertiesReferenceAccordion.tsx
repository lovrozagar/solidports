import { createMemo, createUniqueId, For, omit } from 'solid-js';
import { reactStyle } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import type { EnhancedProperty } from '@mui/internal-docs-infra/useTypes';
import { stringOrHastToString } from '@mui/internal-docs-infra/pipeline/hastUtils';
import { Link } from 'docs/src/components/Link';
import * as Accordion from '../Accordion';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';

interface ProcessedClassProperty extends EnhancedProperty {
  isStatic?: boolean;
  readonly?: boolean;
}
interface Props extends ReactProps<ComponentProps<any>> {
  data: Record<string, ProcessedClassProperty>;
  name: string;
}
export function PropertiesReferenceAccordion(props: Props) {
  const rest = omit(props, 'data', 'name');
  const captionId = createUniqueId();
  return (
    <Accordion.Root
      aria-describedby={captionId}
      {...rest}
      class={clsx('ReferenceAccordionRoot', rest.class)}
      // Lets CSS compute the minimum closed height for `contain-intrinsic-height`;
      // wrapped row content may be taller.
      style={reactStyle({
        '--rows': Object.keys(props.data).length,
        ...rest.style,
      } as JSX.CSSProperties)}
    >
      <span id={captionId} style={reactStyle(visuallyHidden)} aria-hidden="true">
        Class properties table
      </span>
      <Accordion.HeaderRow class="ReferenceHeaderRow">
        <Accordion.HeaderCell>Property</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderTypeCell">Type</Accordion.HeaderCell>
        <Accordion.HeaderCell class="PropertiesHeaderModifiersCell">Modifiers</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      <For each={Object.keys(props.data)}>
        {(name) => {
          const _row = createMemo(() => {
            const prop = props.data[name];

            // Use shortType if available, otherwise use the full type
            const displayShortType = prop.shortType ?? prop.type;
            const displayDetailedType = prop.detailedType ?? prop.type;

            // anchor hash for each property
            const id = `${props.name}-${name}`;
            const shortTypeText = prop.shortType
              ? stringOrHastToString(prop.shortType as string)
              : 'type';

            // Build modifiers string
            const modifiers: string[] = [];
            if (prop.isStatic) {
              modifiers.push('static');
            }
            if (prop.readonly) {
              modifiers.push('readonly');
            }
            const modifiersText = modifiers.join(', ') || '—';
            return (
              <Accordion.Item
                gaCategory="reference"
                gaLabel={`Property: ${id}`}
                gaParams={{
                  type: 'property',
                  slug: id,
                  part_name: props.name,
                }}
              >
                <Accordion.Trigger
                  id={id}
                  aria-label={`Property: ${name}, type: ${shortTypeText}, modifiers: ${modifiersText}`}
                  class="ReferenceTrigger"
                >
                  <Accordion.Scrollable class="ReferenceNameCell">
                    <TableCode
                      class="bui-ws-nw"
                      style={{
                        color: 'var(--color-navy)',
                      }}
                    >
                      {name}
                    </TableCode>
                  </Accordion.Scrollable>
                  {prop.type && (
                    <Accordion.Scrollable class="ReferenceTypeCell">
                      {displayShortType}
                    </Accordion.Scrollable>
                  )}
                  <Accordion.Scrollable class="ReferenceDefaultCell">
                    <TableCode
                      style={{
                        color: 'var(--color-docs-infra-syntax-nullish)',
                      }}
                    >
                      {modifiersText}
                    </TableCode>
                  </Accordion.Scrollable>
                  <span class="ReferenceIconWrap">
                    <svg
                      class="AccordionIcon ReferenceIcon"
                      width="10"
                      height="10"
                      viewBox="0 0 10 10"
                      fill="none"
                    >
                      <path d="M1 3.5L5 7.5L9 3.5" stroke="currentColor" />
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
                            <TableCode
                              style={{
                                color: 'var(--color-blue)',
                              }}
                            >
                              {name}
                            </TableCode>
                          </Link>
                        </DescriptionList.Details>
                      </DescriptionList.Item>

                      {prop.description && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Description</DescriptionList.Term>
                          <DescriptionList.Details class="ReferenceDescription">
                            {prop.description}
                          </DescriptionList.Details>
                        </DescriptionList.Item>
                      )}
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Type</DescriptionList.Term>
                        <DescriptionList.Details>{displayDetailedType}</DescriptionList.Details>
                      </DescriptionList.Item>
                      {modifiers.length > 0 && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Modifiers</DescriptionList.Term>
                          <DescriptionList.Details>
                            <TableCode>{modifiersText}</TableCode>
                          </DescriptionList.Details>
                        </DescriptionList.Item>
                      )}
                    </DescriptionList.Root>
                  </Accordion.Content>
                </Accordion.Panel>
              </Accordion.Item>
            );
          });
          return <>{_row()}</>;
        }}
      </For>
    </Accordion.Root>
  );
}
