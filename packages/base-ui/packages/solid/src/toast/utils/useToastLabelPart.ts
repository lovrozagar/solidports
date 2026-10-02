import { children as resolveChildren, createComponent, Show } from 'solid-js';
import type { Accessor, Setter } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { useId } from '../../utils/useId';
import { useToastRootContext } from '../root/ToastRootContext';
import { useRenderableElement } from './useRenderableElement';
import { createDepsEffect } from '../../solid-helpers';

/**
 * Shared logic for `Toast.Title` and `Toast.Description`, which only differ by the rendered tag,
 * the fallback content, and which id setter they register with. Resolves the content and returns
 * the pieces each part passes to `useRenderElement` and `useToastLabelElement`.
 */
export function useToastLabelPart(
  idProp: Parameters<typeof useId>[0],
  childrenProp: () => JSX.Element,
  part: 'title' | 'description',
) {
  const { toast, setTitleId, setDescriptionId } = useToastRootContext();

  const setId = part === 'title' ? setTitleId : setDescriptionId;
  const children = resolveChildren(
    () => childrenProp() ?? (part === 'title' ? toast().title : toast().description),
  );

  const id = useId(idProp);

  return { id, children, type: () => toast().type, setId };
}

/**
 * Mounts the evaluated label element only when it carries renderable content (so a `render` prop's
 * own children count, while a childless styling-only `render` stays conditional), registering the
 * generated id with the root while the part renders.
 */
export function useToastLabelElement(
  element: () => JSX.Element,
  render: Accessor<unknown>,
  content: Accessor<JSX.Element>,
  id: Accessor<string | undefined>,
  setId: Setter<string | undefined>,
): JSX.Element {
  const { rendered, shouldRender } = useRenderableElement(element, render, content);

  createDepsEffect(
    () => ({ shouldRender: shouldRender(), id: id() }),
    (deps) => {
      if (!deps.shouldRender) {
        return undefined;
      }

      const currentId = deps.id;
      setId(currentId);
      return () => {
        setId((existing) => (existing === currentId ? undefined : existing));
      };
    },
  );

  return createComponent(Show, {
    get when() {
      return shouldRender();
    },
    children: () => rendered() as JSX.Element,
  });
}
