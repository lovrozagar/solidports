/* eslint-disable typescript/no-explicit-any -- generic Value/State/event-handler bridge erased at boundary, mirrors React port */
import { access, type MaybeAccessor } from '../solid-helpers';

export type CustomStyleHookMapping<State> = {
  [Property in keyof State]?: (
    state: State[Property],
  ) => Record<string, MaybeAccessor<string>> | null;
};

export function getStyleHookProps<State extends Record<string, MaybeAccessor<any>>>(
  state: State,
  customMapping?: CustomStyleHookMapping<State>,
) {
  const props: Record<string, string> = {};

  /* eslint-disable-next-line guard-for-in */
  for (const key in state) {
    const value = access(state[key]);
    const resolvedValue = access(value);

    const mapper = customMapping?.[key];
    if (mapper) {
      const customProps = mapper(resolvedValue);
      if (customProps != null) {
        Object.assign(props, customProps);
      }

      continue;
    }

    if (resolvedValue === true) {
      props[`data-${key.toLowerCase()}`] = '';
    } else if (resolvedValue) {
      props[`data-${key.toLowerCase()}`] = resolvedValue.toString();
    }
  }

  return props;
}
