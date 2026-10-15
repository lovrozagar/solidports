import { createMemo, Show } from 'solid-js';
import type { ComponentProps, JSX } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import { useTypes } from '@mui/internal-docs-infra/useTypes';
import type { TypesTableProps } from '@mui/internal-docs-infra/useTypes';
import { ReferenceAccordion } from './ReferenceAccordion';
import { AttributesReferenceTable } from './AttributesReferenceTable';
import { CssVariablesReferenceTable } from './CssVariablesReferenceTable';
import { ParametersReferenceTable } from './ParametersReferenceTable';
import { PropertiesReferenceAccordion } from './PropertiesReferenceAccordion';
import { MethodsReferenceAccordion } from './MethodsReferenceAccordion';
import { AdditionalTypes } from './AdditionalTypes';
import * as CodeBlock from '../CodeBlock';

function SectionHeading(props: { children: JSX.Element }) {
  return <h3 class="ReferenceSectionHeading">{props.children}</h3>;
}
type UseTypesResult = ReturnType<ReturnType<typeof useTypes>>;
type CallableType = Extract<
  NonNullable<UseTypesResult['type']>,
  {
    type: 'hook' | 'function';
  }
>;
type CallableData = CallableType['data'];
function CallableReturnValue(props: { name: string; data: CallableData['returnValue'] }) {
  const _render = createMemo(() => {
    if (!props.data) {
      return null;
    }
    if (props.data.kind === 'object') {
      return (
        <>
          <SectionHeading>Return value</SectionHeading>
          {props.data.typeName && (
            <p class="ReferenceSectionSubtext">
              <code>
                <span class="pl-en">{props.data.typeName}</span>
              </code>
            </p>
          )}
          <ReferenceAccordion
            name={props.name}
            data={props.data.properties}
            nameLabel="Property"
            caption="Return value properties table"
            hideRequired
            hideDefault
            class="ReferenceBlock"
          />
        </>
      );
    }
    return (
      <div class="ReferenceBlock">
        <SectionHeading>Return value</SectionHeading>
        {props.data.type}
        {props.data.detailedType && <CodeBlock.Root>{props.data.detailedType}</CodeBlock.Root>}
      </div>
    );
  });
  return <>{_render()}</>;
}
function CallableReferenceSection(props: {
  data: CallableData;
  multiple?: boolean;
  hideDescription?: boolean;
  additionalTypes?: ReactProps<ComponentProps<typeof AdditionalTypes>>['data'];
  showFallbackParametersHeading: boolean;
  fallbackParametersClassName: string;
}) {
  return (
    <>
      {props.multiple && !props.hideDescription && props.data.description && props.data.description}

      {props.data.expandedProperties && Object.keys(props.data.expandedProperties).length > 0 && (
        <>
          <SectionHeading>
            {props.data.expandedTypeName ? 'Parameters' : 'Properties'}
          </SectionHeading>
          {props.data.expandedTypeName && (
            <p class="ReferenceSectionSubtext">
              <code>
                <span class="pl-en">{props.data.expandedTypeName}</span>
              </code>
            </p>
          )}
          <ReferenceAccordion
            name={props.data.name}
            data={props.data.expandedProperties}
            nameLabel={props.data.expandedTypeName ? 'Prop' : 'Property'}
            caption={
              props.data.expandedTypeName ? 'Parameter properties table' : 'Properties table'
            }
            hideDefault
            class="ReferenceBlock"
          />
        </>
      )}

      {!props.data.expandedProperties &&
        props.data.parameters &&
        props.data.parameters.length > 0 && (
          <>
            {props.showFallbackParametersHeading && <SectionHeading>Parameters</SectionHeading>}
            <ParametersReferenceTable
              name={props.data.name}
              data={props.data.parameters}
              class={props.fallbackParametersClassName}
            />
          </>
        )}

      <CallableReturnValue name={props.data.name} data={props.data.returnValue} />

      {props.additionalTypes && props.additionalTypes.length > 0 && (
        <AdditionalTypes data={props.additionalTypes} multiple={props.multiple} />
      )}
    </>
  );
}
type ReferenceTableProps = TypesTableProps<{
  hideDescription?: boolean;
  showAdditionalTypes?: string[];
}>;
export function ReferenceTable(props: ReferenceTableProps) {
  const _useTypes = useTypes(() => props);
  const _useTypes2 = createMemo(() => {
    const { type, additionalTypes, multiple, hideDescription } = _useTypes();
    return {
      type,
      additionalTypes,
      multiple,
      hideDescription,
    };
  });
  const _render2 = createMemo(() => {
    const _type = _useTypes2().type;
    if (_type?.type === 'component') {
      const data = _type.data;
      return (
        <>
          {_useTypes2().multiple &&
            !_useTypes2().hideDescription &&
            data.description &&
            data.description}

          {Object.keys(data.props).length > 0 && (
            <ReferenceAccordion name={data.name} data={data.props} class="ReferenceBlockSpaced" />
          )}

          {Object.keys(data.dataAttributes).length > 0 && (
            <AttributesReferenceTable
              name={data.name}
              data={data.dataAttributes}
              class="ReferenceBlockSpaced"
            />
          )}

          {Object.keys(data.cssVariables).length > 0 && (
            <CssVariablesReferenceTable
              name={data.name}
              data={data.cssVariables}
              class="ReferenceBlockSpaced"
            />
          )}

          <Show when={_useTypes2().additionalTypes}>
            {(_additionalTypes) =>
              _additionalTypes().length > 0 && (
                <AdditionalTypes data={_additionalTypes()} multiple={_useTypes2().multiple} />
              )
            }
          </Show>
        </>
      );
    }
    if (_type?.type === 'hook' || _type?.type === 'function') {
      const data = _type.data;
      return (
        <CallableReferenceSection
          data={data}
          multiple={_useTypes2().multiple}
          hideDescription={_useTypes2().hideDescription}
          additionalTypes={_useTypes2().additionalTypes}
          showFallbackParametersHeading={_type.type === 'function'}
          fallbackParametersClassName={
            _type.type === 'function' ? 'ReferenceBlock' : 'ReferenceBlockSpaced'
          }
        />
      );
    }
    if (_type?.type === 'class') {
      const data = _type.data;

      // Separate static and instance methods
      const staticMethods: Record<string, (typeof data.methods)[string]> = {};
      const instanceMethods: Record<string, (typeof data.methods)[string]> = {};
      Object.entries(data.methods).forEach(([name, method]) => {
        if (method.isStatic) {
          staticMethods[name] = method;
        } else {
          instanceMethods[name] = method;
        }
      });
      return (
        <>
          {_useTypes2().multiple &&
            !_useTypes2().hideDescription &&
            data.description &&
            data.description}

          {Object.keys(staticMethods).length > 0 && (
            <>
              <SectionHeading>Static methods</SectionHeading>
              <MethodsReferenceAccordion
                name={data.name}
                data={staticMethods}
                class="ReferenceBlock"
                methodLabel="Static method"
              />
            </>
          )}

          {data.constructorParameters.length > 0 && (
            <>
              <SectionHeading>Constructor parameters</SectionHeading>
              <ParametersReferenceTable
                name={data.name}
                data={data.constructorParameters}
                class="ReferenceBlock"
              />
            </>
          )}

          {Object.keys(data.properties).length > 0 && (
            <>
              <SectionHeading>Properties</SectionHeading>
              <PropertiesReferenceAccordion
                name={data.name}
                data={data.properties}
                class="ReferenceBlock"
              />
            </>
          )}

          {Object.keys(instanceMethods).length > 0 && (
            <>
              <SectionHeading>Methods</SectionHeading>
              <MethodsReferenceAccordion
                name={data.name}
                data={instanceMethods}
                class="ReferenceBlock"
              />
            </>
          )}

          <Show when={_useTypes2().additionalTypes}>
            {(_additionalTypes2) =>
              _additionalTypes2().length > 0 && (
                <AdditionalTypes
                  data={_additionalTypes2()}
                  multiple={_useTypes2().multiple}
                  show={props.showAdditionalTypes}
                />
              )
            }
          </Show>
        </>
      );
    }

    // type.type === 'raw'
    return (
      <>
        <Show when={_useTypes2().additionalTypes}>
          {(_additionalTypes3) =>
            _additionalTypes3().length > 0 && (
              <AdditionalTypes
                data={_additionalTypes3()}
                multiple={_useTypes2().multiple}
                show={props.showAdditionalTypes}
              />
            )
          }
        </Show>
      </>
    );
  });
  return <>{_render2()}</>;
}
