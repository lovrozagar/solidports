import { createMemo, createUniqueId, For, merge, omit } from 'solid-js';
import { reactStyle } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import type { EnhancedProperty } from '@mui/internal-docs-infra/useTypes';
import { stringOrHastToString } from '@mui/internal-docs-infra/pipeline/hastUtils';
import { Link } from 'docs/src/components/Link';
import * as Accordion from '../Accordion';
import * as CodeBlock from '../CodeBlock';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';

/** Workaround for strange Server -> Client Component behavior */
function TableDefault(props: { children: JSX.Element }) {
  return <>{props.children}</>;
}
interface Props extends ReactProps<ComponentProps<any>> {
  data: Record<string, EnhancedProperty>;
  name: string;
  nameLabel?: string;
  caption?: string;
  /** Hide the required indicator (red star) - useful for return values where "required" doesn't apply */
  hideRequired?: boolean;
  /** Hide the default value column - useful for return values that don't have defaults */
  hideDefault?: boolean;
}
export function ReferenceAccordion(_props: Props) {
  const props = merge(
    {
      nameLabel: 'Prop',
      caption: 'Component props table',
      hideRequired: false,
      hideDefault: false,
    },
    _props,
  );
  const rest = omit(props, 'data', 'name', 'nameLabel', 'caption', 'hideRequired', 'hideDefault');
  const captionId = createUniqueId();
  return (
    <Accordion.Root
      aria-describedby={captionId}
      data-hide-default={props.hideDefault || undefined}
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
        {props.caption}
      </span>
      <Accordion.HeaderRow class="ReferenceHeaderRow">
        <Accordion.HeaderCell>{props.nameLabel}</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderTypeCell">Type</Accordion.HeaderCell>
        {!props.hideDefault && (
          <Accordion.HeaderCell class="ReferenceHeaderDefaultCell">Default</Accordion.HeaderCell>
        )}
        <Accordion.HeaderCell class="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      <For each={Object.keys(props.data)}>
        {(name) => {
          const _row = createMemo(() => {
            const prop = props.data[name];

            // Use shortType if available (set by useTypes), otherwise use the full type
            const displayShortType = prop.shortType ?? prop.type;
            const displayDetailedType = prop.detailedType ?? prop.type;

            // anchor hash for each prop
            const id = `${props.name.replace('.', '')}-${name}`;
            const shortTypeText = prop.shortType
              ? stringOrHastToString(prop.shortType as string)
              : 'type';
            const defaultText = prop.defaultText;
            return (
              <Accordion.Item
                gaCategory="reference"
                gaLabel={`${props.nameLabel}: ${id}`}
                gaParams={{
                  type: props.nameLabel.toLowerCase(),
                  slug: id,
                  part_name: props.name,
                }}
              >
                <Accordion.Trigger
                  id={id}
                  aria-label={`${props.nameLabel}: ${name},${!props.hideRequired && prop.required ? ' required,' : ''} type: ${shortTypeText} ${defaultText !== undefined ? `(default: ${defaultText})` : ''}`}
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
                      {!props.hideRequired && prop.required ? (
                        <sup class="ReferenceRequired">*</sup>
                      ) : (
                        ''
                      )}
                    </TableCode>
                  </Accordion.Scrollable>
                  {prop.type && (
                    <Accordion.Scrollable class="ReferenceTypeCell">
                      {displayShortType}
                    </Accordion.Scrollable>
                  )}
                  {!props.hideDefault && (
                    <Accordion.Scrollable class="ReferenceDefaultCell">
                      {prop.required || prop.default === undefined ? (
                        <TableCode
                          style={{
                            color: 'var(--color-docs-infra-syntax-nullish)',
                          }}
                        >
                          —
                        </TableCode>
                      ) : (
                        <TableDefault>{prop.default}</TableDefault>
                      )}
                    </Accordion.Scrollable>
                  )}
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
                          {/* one-off override of the default mt/mb on CodeBlock.Root */}
                          <DescriptionList.Details class="ReferenceDescription">
                            {prop.description}
                          </DescriptionList.Details>
                        </DescriptionList.Item>
                      )}
                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Type</DescriptionList.Term>
                        <DescriptionList.Details>
                          <CodeBlock.Root>{displayDetailedType}</CodeBlock.Root>
                        </DescriptionList.Details>
                      </DescriptionList.Item>
                      {!props.hideDefault && prop.default !== undefined && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Default</DescriptionList.Term>
                          <DescriptionList.Details>{prop.default}</DescriptionList.Details>
                        </DescriptionList.Item>
                      )}

                      {prop.example && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Example</DescriptionList.Term>
                          <DescriptionList.Details class="ReferenceExampleReset">
                            {prop.example}
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
