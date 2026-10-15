import { createMemo, createUniqueId, For, merge, omit } from 'solid-js';
import { reactStyle } from 'docs/src/adapters/react';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import clsx from 'clsx';
import { visuallyHidden } from '@base-ui/utils/visuallyHidden';
import type { EnhancedMethod } from '@mui/internal-docs-infra/useTypes';
import { Link } from 'docs/src/components/Link';
import * as Accordion from '../Accordion';
import * as DescriptionList from '../DescriptionList';
import { TableCode } from '../TableCode';

interface Props extends ReactProps<ComponentProps<any>> {
  data: Record<string, EnhancedMethod>;
  name: string;
  methodLabel?: string;
}
export function MethodsReferenceAccordion(_props: Props) {
  const props = merge(
    {
      methodLabel: 'Method',
    },
    _props,
  );
  const rest = omit(props, 'data', 'name', 'methodLabel');
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
        Class methods table
      </span>
      <Accordion.HeaderRow class="MethodsHeaderRow">
        <Accordion.HeaderCell>{props.methodLabel}</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderTypeCell">Returns</Accordion.HeaderCell>
        <Accordion.HeaderCell class="ReferenceHeaderIconCell" />
      </Accordion.HeaderRow>
      <For each={Object.keys(props.data)}>
        {(name) => {
          const _row = createMemo(() => {
            const method = props.data[name];

            // anchor hash for each method
            const id = `${props.name}-${name}`;
            return (
              <Accordion.Item
                gaCategory="reference"
                gaLabel={`Method: ${id}`}
                gaParams={{
                  type: 'method',
                  slug: id,
                  part_name: props.name,
                }}
              >
                <Accordion.Trigger
                  id={id}
                  aria-label={`Method: ${name}, returns: ${method.returnValue ? 'value' : 'void'}`}
                  class="MethodsTrigger"
                >
                  <Accordion.Scrollable class="ReferenceNameCell">
                    <code class="Code language-ts TableCode">
                      <span class="pl-en">{name}</span>
                      {'('}
                      <For each={method.parameters}>
                        {(param, i) => (
                          <>
                            {i() !== 0 && ', '}
                            <span class="pl-v">{param.name}</span>
                            {param.optional && '?'}
                          </>
                        )}
                      </For>
                      {')'}
                    </code>
                  </Accordion.Scrollable>
                  <Accordion.Scrollable class="ReferenceTypeCell">
                    {method.returnValue}
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

                      {method.description && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Description</DescriptionList.Term>
                          <DescriptionList.Details class="ReferenceDescription">
                            {method.description}
                          </DescriptionList.Details>
                        </DescriptionList.Item>
                      )}

                      {method.parameters.length > 0 && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Parameters</DescriptionList.Term>
                          <DescriptionList.Details>
                            <ul class="MethodParamList">
                              <For each={method.parameters}>
                                {(param) => (
                                  <li>
                                    <div class="MethodParamRow">
                                      <TableCode
                                        style={{
                                          color: 'var(--color-navy)',
                                        }}
                                        class="bui-ws-nw"
                                      >
                                        {param.name}
                                        {param.optional && '?'}
                                      </TableCode>
                                      <span class="MethodParamSep">—</span>
                                      {param.type}
                                    </div>
                                    {param.description && (
                                      <div class="MethodParamDesc">{param.description}</div>
                                    )}
                                  </li>
                                )}
                              </For>
                            </ul>
                          </DescriptionList.Details>
                        </DescriptionList.Item>
                      )}

                      <DescriptionList.Item>
                        <DescriptionList.Term separator>Returns</DescriptionList.Term>
                        <DescriptionList.Details>{method.returnValue}</DescriptionList.Details>
                      </DescriptionList.Item>

                      {method.returnValueDescription && (
                        <DescriptionList.Item>
                          <DescriptionList.Term separator>Return description</DescriptionList.Term>
                          <DescriptionList.Details>
                            {method.returnValueDescription}
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
