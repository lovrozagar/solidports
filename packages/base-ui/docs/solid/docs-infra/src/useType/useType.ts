import { createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useTypesDataContext } from './TypesDataContext';
import type { TypeData } from './TypesDataContext';

/**
 * Props passed to the custom `typeRefComponent` element.
 */
export interface TypeRefProps {
  /** The anchor href for the type documentation */
  href: string;
  /** The matched identifier name (e.g., "Trigger", "Accordion.Trigger") */
  name: string;
  /** Optional CSS class name(s) inherited from the syntax highlighting span */
  class?: string;
  /** The rendered text content */
  children: JSX.Element;
}

/**
 * Hook to look up a single type's data by name from the nearest `TypesDataProvider`.
 *
 * Returns the `TypeData` for the given name, or `undefined` if:
 * - No `TypesDataProvider` is present in the tree
 * - The type name has not been registered
 *
 * @param name - The type name to look up (e.g., "Root", "Trigger", "AccordionTrigger")
 */
export function useType(name: Accessor<string>): Accessor<TypeData | undefined> {
  const context = useTypesDataContext();
  return createMemo(() => context()?.types.get(name()));
}
