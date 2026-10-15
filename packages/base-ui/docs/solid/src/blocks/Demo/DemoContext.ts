import { createContext, createMemo, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { DemoFile, DemoVariant } from './types';

export interface DemoContext {
  selectedFile: DemoFile;
  selectedVariant: DemoVariant;
  setSelectedVariant: (variant: DemoVariant) => void;
  variants: DemoVariant[];
}
export const DemoContext = createContext<Accessor<DemoContext | undefined>>(() => undefined);
export function useDemoContext() {
  const context = useContext(DemoContext);
  return createMemo(() => {
    const _context = context();
    if (!_context) {
      throw new Error('useDemoContext must be used within a DemoProvider');
    }
    return _context;
  });
}
