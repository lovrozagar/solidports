import { createEffect, createMemo } from 'solid-js';
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
  const registerTypes = createMemo(() => context()?.registerTypes);
  const registerTypeProps = createMemo(() => context()?.registerTypeProps);
  const _contentProps = createMemo(() => {
    const { type, additionalTypes } = contentProps();
    return {
      type,
      additionalTypes,
    };
  });
  createEffect(
    () => [registerTypes(), _contentProps().type, _contentProps().additionalTypes],
    () => {
      const _registerTypes = registerTypes();
      if (!_registerTypes) {
        return;
      }
      const entries: Array<{
        name: string;
        data: TypeData;
      }> = [];
      const _type = _contentProps().type;
      if (_type) {
        const typeData: TypeData = {
          meta: _type,
          href: _type.slug ? `#${_type.slug}` : `#${_type.name.toLowerCase()}`,
        };
        entries.push({
          name: _type.name,
          data: typeData,
        });
        // Also register under alias names (e.g., flat export name like "AccordionRootProps")
        if (_type.aliases) {
          for (const alias of _type.aliases) {
            entries.push({
              name: alias,
              data: typeData,
            });
          }
        }
      }
      for (const additional of _contentProps().additionalTypes) {
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
        _registerTypes(entries);
      }
    },
  );
  createEffect(
    () => [registerTypeProps(), _contentProps().type, _contentProps().additionalTypes],
    () => {
      const _registerTypeProps = registerTypeProps();
      if (!_registerTypeProps) {
        return;
      }
      const propEntries: Array<{
        key: string;
        data: TypePropData;
      }> = [];
      const _type2 = _contentProps().type;
      if (_type2) {
        propEntries.push(...collectTypeProps(_type2));
      }
      for (const additional of _contentProps().additionalTypes) {
        propEntries.push(...collectTypeProps(additional));
      }
      if (propEntries.length > 0) {
        _registerTypeProps(propEntries);
      }
    },
  );
  return contentProps;
}
