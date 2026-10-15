// docs-infra's `useType`, kept by hand for Solid.
import { createMemo, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { TypesDataContext } from './TypesDataContext';
import type { TypeData, TypePropData } from './TypesDataContext';

/**
 * Provider that collects type data from all `useTypes()` calls within its subtree.
 * This enables `useType(name)` to look up individual type data anywhere in the tree,
 * and `useTypeProp(typeName, propName)` to look up individual properties.
 */
export function TypesDataProvider(props: { children: JSX.Element }) {
  const [types, setTypes] = createSignal<Map<string, TypeData>>(new Map());
  const [typeProps, setTypeProps] = createSignal<Map<string, TypePropData>>(new Map());
  const registerTypes = (
    entries: Array<{
      name: string;
      data: TypeData;
    }>,
  ) => {
    setTypes((prev) => {
      let changed = false;
      for (const entry of entries) {
        const existing = prev.get(entry.name);
        if (existing?.meta !== entry.data.meta || existing?.href !== entry.data.href) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        return prev;
      }
      const next = new Map(prev);
      for (const entry of entries) {
        next.set(entry.name, entry.data);
      }
      return next;
    });
  };
  const registerTypeProps = (
    entries: Array<{
      key: string;
      data: TypePropData;
    }>,
  ) => {
    setTypeProps((prev) => {
      let changed = false;
      for (const entry of entries) {
        const existing = prev.get(entry.key);
        if (existing?.property !== entry.data.property || existing?.href !== entry.data.href) {
          changed = true;
          break;
        }
      }
      if (!changed) {
        return prev;
      }
      const next = new Map(prev);
      for (const entry of entries) {
        next.set(entry.key, entry.data);
      }
      return next;
    });
  };
  const value = createMemo(() => ({
    types: types(),
    registerTypes,
    typeProps: typeProps(),
    registerTypeProps,
  }));
  return <TypesDataContext value={value}>{props.children}</TypesDataContext>;
}
