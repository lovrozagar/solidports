import { ReferenceAccordion } from "./ReferenceAccordion"
import type { FunctionParamDef, PropDef } from "./types"

interface ParametersReferenceTableProps {
  data: Record<string, FunctionParamDef>
  name: string
  renameFrom?: string
  renameTo?: string
  class?: string
}

function normalizeParameters(data: Record<string, FunctionParamDef>) {
  return Object.fromEntries(
    Object.entries(data).map(([name, param]) => {
      const { optional, ...rest } = param
      const normalized: PropDef = {
        ...rest,
        required: optional ? undefined : true,
      }
      return [name, normalized]
    }),
  )
}

export function ParametersReferenceTable(props: ParametersReferenceTableProps) {
  return (
    <ReferenceAccordion
      class={props.class}
      name={props.name}
      data={normalizeParameters(props.data)}
      renameFrom={props.renameFrom}
      renameTo={props.renameTo}
      nameLabel="Parameter"
      caption="Function parameters table"
    />
  )
}
