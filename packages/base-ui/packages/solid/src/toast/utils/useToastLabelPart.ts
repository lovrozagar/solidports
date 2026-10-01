import { createEffect, onCleanup, type JSX, type Setter } from 'solid-js';
import { useId } from '../../utils/useId';
import { useToastRootContext } from '../root/ToastRootContext';
import { hasRenderableChildren } from './isRenderableNode';

/**
 * Shared logic for `Toast.Title` and `Toast.Description`.
 */
export function useToastLabelPart(
  idProp: () => string | undefined,
  childrenProp: () => JSX.Element,
  part: 'title' | 'description',
) {
  const { toast, setTitleId, setDescriptionId } = useToastRootContext();

  const setId = part === 'title' ? setTitleId : setDescriptionId;
  const children = () =>
    childrenProp() ?? (part === 'title' ? toast().title : toast().description);

  const id = useId(idProp);

  return { id, children, type: () => toast().type, setId };
}

/**
 * Registers the generated id with the root while the part renders.
 */
export function useToastLabelElement(
  element: JSX.Element,
  id: () => string | undefined,
  setId: Setter<string | undefined>,
): JSX.Element {
  const shouldRender = () => hasRenderableChildren(element);

  createEffect(() => {
    if (!shouldRender()) {
      return;
    }
    const currentId = id();
    setId(currentId);
    onCleanup(() => {
      setId((existing) => (existing === currentId ? undefined : existing));
    });
  });

  return shouldRender() ? element : null;
}
