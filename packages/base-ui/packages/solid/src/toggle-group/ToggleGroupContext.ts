/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { createContext, useContext } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { BaseUIChangeEventDetails } from '../utils/createBaseUIEventDetails';
import type { BaseUIEventReasons } from '../utils/reasons';

export interface ToggleGroupContext<Value> {
  value: Accessor<readonly Value[]>;
  setGroupValue: (
    newValue: Value,
    nextPressed: boolean,
    eventDetails: BaseUIChangeEventDetails<BaseUIEventReasons['none']>,
  ) => void;
  disabled: Accessor<boolean>;
  /**
   * Indicates whether the value has been initialized via `value` or `defaultValue` props.
   * Used to determine if Toggle should warn users about data inconsistency problems.
   */
  isValueInitialized: Accessor<boolean>;
}

export const ToggleGroupContext = createContext<ToggleGroupContext<any> | null>(null);

export function useToggleGroupContext(optional = true) {
  const context = useContext(ToggleGroupContext);
  if (context == null && !optional) {
    throw new Error(
      'Base UI: ToggleGroupContext is missing. ToggleGroup parts must be placed within <ToggleGroup>.',
    );
  }

  return context;
}
