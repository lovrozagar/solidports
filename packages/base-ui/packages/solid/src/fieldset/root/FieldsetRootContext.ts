/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';

export interface FieldsetRootContext {
  legendId: Accessor<string | undefined>;
  setLegendId: Setter<string | undefined>;
  disabled: Accessor<boolean | undefined>;
}

export const FieldsetRootContext = createContext<FieldsetRootContext>({
  disabled: () => undefined,
  legendId: () => undefined,
  setLegendId: (() => {}) as any,
});

export function useFieldsetRootContext(optional: true): FieldsetRootContext | null;
export function useFieldsetRootContext(optional?: false): FieldsetRootContext;
export function useFieldsetRootContext(optional = false) {
  const context = useContext(FieldsetRootContext);
  if (!context && !optional) {
    throw new Error(
      'Base UI: FieldsetRootContext is missing. Fieldset parts must be placed within <Fieldset.Root>.',
    );
  }
  return context;
}
