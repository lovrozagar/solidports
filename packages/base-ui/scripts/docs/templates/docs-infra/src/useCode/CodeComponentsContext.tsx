// docs-infra's `CodeComponentsContext`, kept by hand for Solid: the components highlighted code
// renders its elements with (links, type references).
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { HastComponents } from '../pipeline/hastToSolid';

export const CodeComponentsContext = createContext<Accessor<HastComponents | undefined>>(
  () => undefined,
);

export function useCodeComponents(): Accessor<HastComponents | undefined> {
  return useContext(CodeComponentsContext);
}
