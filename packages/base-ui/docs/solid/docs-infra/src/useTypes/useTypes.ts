// docs-infra's `useTypes`, kept by hand for Solid.
import { onSettled, untrack } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { EnhancedProperty, EnhancedTypesMeta } from '../abstractCreateTypes/typesToJsx';
import { useTypesDataContext } from '../useType/TypesDataContext';
import type { TypeData, TypePropData } from '../useType/TypesDataContext';
import { toKebabCase } from '../pipeline/loaderUtils/toKebabCase';

export type TypesTableProps<T extends {}> = T & {
  /**
   * The main type for this export (component, hook, or function).
   * Undefined when rendering only additional types (e.g., AdditionalTypes component).
   */
  type: EnhancedTypesMeta | undefined;
  /**
   * Additional types related to this export.
   * Includes both namespaced types (like .Props, .State) and global non-namespaced types.
   */
  additionalTypes: EnhancedTypesMeta[];
  multiple?: boolean;
};

/**
 * Collects the properties from an EnhancedTypesMeta entry into key/data pairs.
 * - Component types: extracts `data.props`
 * - Hook/function types: extracts `data.expandedProperties` (the expanded properties of the options object)
 */
function collectTypeProps(typeMeta: EnhancedTypesMeta): Array<{
  key: string;
  data: TypePropData;
}> {
  const slug = typeMeta.slug ?? typeMeta.name.toLowerCase();
  const entries: Array<{
    key: string;
    data: TypePropData;
  }> = [];
  const names = [typeMeta.name, ...(typeMeta.aliases ?? [])];
  function addProperties(params: Record<string, EnhancedProperty>) {
    for (const [propName, prop] of Object.entries(params)) {
      const data: TypePropData = {
        property: prop,
        href: `#${slug}:${toKebabCase(propName)}`,
      };
      for (const name of names) {
        entries.push({
          key: `${name}:${propName}`,
          data,
        });
      }
    }
  }
  if (typeMeta.type === 'component') {
    addProperties(typeMeta.data.props);
  } else if (typeMeta.type === 'hook' || typeMeta.type === 'function') {
    if (typeMeta.data.expandedProperties) {
      addProperties(typeMeta.data.expandedProperties);
    }
  } else if (typeMeta.type === 'raw') {
    if (typeMeta.data.properties) {
      addProperties(typeMeta.data.properties);
    }
  }
  return entries;
}

/**
 * Hook for accessing types props in TypesTable components.
 *
 * When rendered inside a `TypesDataProvider`, automatically registers
 * the main type and additional types into the context so they can be
 * looked up by name via `useType(name)`, and registers their properties
 * so they can be looked up via `useTypeProp(typeName, propName)`.
 */
export function useTypes<T extends {}>(
  contentProps: Accessor<TypesTableProps<T>>,
): Accessor<TypesTableProps<T>> {
  const context = useTypesDataContext();
  // Registered once mounted, as upstream registers in effects: the server and the client's first
  // render see no registered types, so they render the same type references.
  onSettled(() => {
    const value = untrack(context);
    const { type, additionalTypes } = untrack(contentProps);
    if (value?.registerTypes) {
      const entries: Array<{
        name: string;
        data: TypeData;
      }> = [];
      if (type) {
        const typeData: TypeData = {
          meta: type,
          href: type.slug ? `#${type.slug}` : `#${type.name.toLowerCase()}`,
        };
        entries.push({
          name: type.name,
          data: typeData,
        });
        // Also register under alias names (e.g., flat export name like "AccordionRootProps")
        if (type.aliases) {
          for (const alias of type.aliases) {
            entries.push({
              name: alias,
              data: typeData,
            });
          }
        }
      }
      for (const additional of additionalTypes) {
        const additionalData: TypeData = {
          meta: additional,
          href: additional.slug ? `#${additional.slug}` : `#${additional.name.toLowerCase()}`,
        };
        entries.push({
          name: additional.name,
          data: additionalData,
        });
        // Also register under alias names
        if (additional.aliases) {
          for (const alias of additional.aliases) {
            entries.push({
              name: alias,
              data: additionalData,
            });
          }
        }
      }
      if (entries.length > 0) {
        value.registerTypes(entries);
      }
    }
    if (value?.registerTypeProps) {
      const propEntries: Array<{
        key: string;
        data: TypePropData;
      }> = [];
      if (type) {
        propEntries.push(...collectTypeProps(type));
      }
      for (const additional of additionalTypes) {
        propEntries.push(...collectTypeProps(additional));
      }
      if (propEntries.length > 0) {
        value.registerTypeProps(propEntries);
      }
    }
  });
  return contentProps;
}
