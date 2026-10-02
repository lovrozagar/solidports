import { createEffect } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { MaybeAccessor } from '../solid-helpers';
import { useBaseUiId } from './useBaseUiId';

export function useRegisteredLabelId(
  idProp: MaybeAccessor<string | undefined>,
  setLabelId: Setter<string | undefined>,
): Accessor<string | undefined> {
  const id = useBaseUiId(idProp);

  // Solid: a user effect, since a render effect's mount-time apply may not write signals.
  createEffect(id, (currentId) => {
    setLabelId(currentId);
    return () => {
      setLabelId((labelId) => (labelId === currentId ? undefined : labelId));
    };
  });

  return id;
}
