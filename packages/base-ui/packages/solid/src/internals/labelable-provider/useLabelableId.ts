import { onCleanup } from 'solid-js';
import { access, createDepsEffect, type MaybeAccessor } from '../../solid-helpers';
import { NOOP } from '../../utils/noop';
import { useBaseUiId } from '../../utils/useBaseUiId';
import { useLabelableContext } from './LabelableContext';

export function useLabelableId(params: UseLabelableIdParameters = {}) {
  // Solid: `false` is accepted from callers that forward an unset prop; it means no explicit id.
  const id = (): string | null | undefined => {
    const value = access(params.id);
    return value === false ? undefined : value;
  };
  const enabled = () => access(params.enabled) ?? true;

  const { controlId, registerControlId, resetControlId } = useLabelableContext();

  // Deliberately not seeded with `id`: the seed would stick around after the `id` prop is
  // removed, leaving the control on a stale id forever.
  const defaultId = useBaseUiId();

  const controlSourceRef = Symbol('labelable-control');
  let hasRegisteredRef = false;
  let hadExplicitIdRef = false;

  const unregisterControlId = () => {
    if (!hasRegisteredRef || registerControlId === NOOP) {
      return;
    }

    hasRegisteredRef = false;
    registerControlId(controlSourceRef, undefined);
  };

  createDepsEffect(
    () => ({ id: id(), enabled: enabled(), defaultId: defaultId() }),
    (deps) => {
      if (!deps.enabled || registerControlId === NOOP) {
        unregisterControlId();
        return;
      }

      let nextId: string | null | undefined;

      if (deps.id !== undefined) {
        hadExplicitIdRef = true;
        nextId = deps.id;
      } else if (hadExplicitIdRef) {
        nextId = deps.defaultId;
      } else {
        // An id-less replacement must claim the provider's fallback so a previously registered
        // explicit id is not retained after its control unmounts.
        resetControlId();
        return;
      }

      if (nextId === undefined) {
        unregisterControlId();
        return;
      }

      hasRegisteredRef = true;
      registerControlId(controlSourceRef, nextId);
    },
  );

  // Unregister on unmount so a replacement control does not still see the outgoing
  // control's registration.
  onCleanup(unregisterControlId);

  // The provider's id wins until registration runs: the label renders `for` from the
  // provider's pre-registration state, so preempting it with an explicit `id` here would
  // leave the pair unassociated in server-rendered markup.
  return (): string | undefined => (enabled() ? controlId() : undefined) ?? id() ?? defaultId();
}

export interface UseLabelableIdParameters {
  /**
   * The control's `id`. Pass `null` for a control that takes its name from `aria-labelledby`
   * instead, so that the label omits `for`.
   */
  id?: MaybeAccessor<string | null | false | undefined>;
  /**
   * Whether the control owns the label association of its labelable scope.
   * @default true
   */
  enabled?: MaybeAccessor<boolean | undefined>;
}

export type UseLabelableIdReturnValue = string;

export interface UseLabelableIdState {}

export namespace useLabelableId {
  export type Parameters = UseLabelableIdParameters;
  export type ReturnValue = UseLabelableIdReturnValue;
}
