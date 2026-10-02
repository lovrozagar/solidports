import { createTrackedEffect, onCleanup } from 'solid-js';
import type { Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
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

  createTrackedEffect(() => {
    const _c: Array<() => void> = [];
    (() => {

    if (!shouldRender()) {
      return;
    }
    const currentId = id();
    setId(currentId);
    _c.push(() => {
      setId((existing) => (existing === currentId ? undefined : existing));
    });
      })();
    return () => {
      for (let i = _c.length - 1; i >= 0; i -= 1) {
        _c[i]();
      }
    };
});

  return shouldRender() ? element : null;
}
