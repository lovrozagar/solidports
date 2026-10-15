import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { Components } from 'docs/src/adapters/hast-util-to-jsx-runtime';

type CodeComponents = Partial<Components>;
export const CodeComponentsContext = createContext<Accessor<CodeComponents | undefined>>(
  () => undefined,
);
export function useCodeComponents(): Accessor<CodeComponents | undefined> {
  return useContext(CodeComponentsContext);
}
