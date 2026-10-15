import { omit } from 'solid-js';
import type { ComponentProps } from '@solidjs/web';
import type { ReactProps } from 'docs/src/adapters/react';
import type { EnhancedParameter, EnhancedProperty } from '@mui/internal-docs-infra/useTypes';
import { ReferenceAccordion } from './ReferenceAccordion';

interface ParametersReferenceTableProps extends ReactProps<ComponentProps<any>> {
  data: EnhancedParameter[];
  name: string;
}
function normalizeParameters(data: EnhancedParameter[]) {
  return Object.fromEntries(
    data.map((param) => {
      const { optional, name, ...rest } = param;
      return [
        name,
        {
          ...rest,
          required: optional ? undefined : true,
        },
      ];
    }),
  ) as Record<string, EnhancedProperty>;
}
export function ParametersReferenceTable(props: ParametersReferenceTableProps) {
  const rest = omit(props, 'data', 'name');
  return (
    <ReferenceAccordion
      {...rest}
      name={props.name}
      data={normalizeParameters(props.data)}
      nameLabel="Parameter"
      caption="Function parameters table"
    />
  );
}
