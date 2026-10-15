import { createContext, createMemo, createSignal, onSettled, untrack, useContext } from 'solid-js';
import { initialState } from 'docs/src/adapters/react';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';

export interface PackageManagerSnippetContext {
  packageManager: string;
  setPackageManager: (variant: string) => void;
}
export const PackageManagerSnippetContext = createContext<
  Accessor<PackageManagerSnippetContext | null>
>(() => null);
export const usePackageManagerSnippetContext = () => {
  const context = useContext(PackageManagerSnippetContext);
  return createMemo(() => {
    const _context = context();
    if (!_context) {
      throw new Error('Missing PackageManagerSnippetContext');
    }
    return _context;
  });
};
interface PackageManagerSnippetProviderProps {
  children: JSX.Element;
  defaultValue: string;
}
const STORAGE_KEY = 'preferredPackageManager';
export function PackageManagerSnippetProvider(props: PackageManagerSnippetProviderProps) {
  const [value, setValue] = createSignal(() => untrack(() => initialState(props.defaultValue)));
  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    localStorage.setItem(STORAGE_KEY, newValue);
  };
  onSettled(() => {
    const savedValue = localStorage.getItem(STORAGE_KEY);
    if (savedValue) {
      setValue(savedValue);
    }
  });
  const contextValue = createMemo(() => ({
    packageManager: value(),
    setPackageManager: handleValueChange,
  }));
  return (
    <PackageManagerSnippetContext value={contextValue}>
      {props.children}
    </PackageManagerSnippetContext>
  );
}
