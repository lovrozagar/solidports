export interface ComponentDef {
  name: string;
  description?: string;
  props: Record<string, PropDef>;
  dataAttributes: Record<string, AttributeDef>;
  cssVariables: Record<string, CssVariableDef>;
}

export interface PropDef {
  type?: string;
  expanded?: string;
  default?: string;
  required?: boolean;
  description?: string;
  /** `description` rendered to HTML at build time (rehypeReference). */
  descriptionHtml?: string;
  detailedType?: string;
  example?: string;
}

export interface AttributeDef {
  type?: string;
  description?: string;
  /** `description` rendered to HTML at build time (rehypeReference). */
  descriptionHtml?: string;
}

export interface CssVariableDef {
  type?: string;
  description?: string;
  /** `description` rendered to HTML at build time (rehypeReference). */
  descriptionHtml?: string;
}

export interface FunctionParamDef extends PropDef {
  optional?: boolean;
}

export interface FunctionDef {
  name: string;
  description?: string;
  parameters?: Record<string, FunctionParamDef>;
  returnValue?: Record<string, PropDef> | PropDef | string;
}
