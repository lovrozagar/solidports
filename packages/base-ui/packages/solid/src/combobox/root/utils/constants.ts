/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
export const NO_ACTIVE_VALUE = Symbol('none');
export const INITIAL_LAST_HIGHLIGHT: { value: any; index: number } = {
  index: -1,
  value: NO_ACTIVE_VALUE,
} as const;
