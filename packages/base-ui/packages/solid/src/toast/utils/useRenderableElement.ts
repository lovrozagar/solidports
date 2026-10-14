import { children as resolveChildren, createMemo } from 'solid-js';
import type { Accessor } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { isRenderableNode } from './isRenderableNode';
import { isDomNode } from '../../utils/isDomNode';

/**
 * The children the part's element ends up with, as React's render merge resolves them: a render
 * config's own `children` replace the part's content.
 */
export function getRenderContent(render: unknown, content: JSX.Element): JSX.Element {
  if (render != null && typeof render === 'object' && !isDomNode(render)) {
    return (render as { children?: JSX.Element | undefined }).children ?? content;
  }
  return content;
}

function hasRenderedContent(nodes: unknown[]) {
  return nodes.some(
    (node) =>
      isDomNode(node) &&
      (node.nodeType === Node.TEXT_NODE ? node.textContent !== '' : node.hasChildNodes()),
  );
}

/**
 * Solid: React evaluates the part's element and renders it only when `hasRenderableChildren`
 * finds content in its `props.children`. A Solid element is DOM once evaluated, so the check reads
 * the resolved content instead, and a render function's output, which only exists once it runs,
 * is inspected as rendered nodes.
 */
export function useRenderableElement(
  element: () => JSX.Element,
  render: Accessor<unknown>,
  content: Accessor<JSX.Element>,
) {
  const rendered = resolveChildren(element);

  const shouldRender = createMemo(() => {
    if (typeof render() === 'function') {
      const nodes = rendered.toArray();
      return nodes.length > 0 && (isRenderableNode(content()) || hasRenderedContent(nodes));
    }

    return isRenderableNode(content());
  });

  return { rendered, shouldRender };
}
