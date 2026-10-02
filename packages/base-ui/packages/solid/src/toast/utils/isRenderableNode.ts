import type { JSX } from '@solidjs/web';

export function isRenderableNode(node: JSX.Element): boolean {
  if (node == null || typeof node === 'boolean' || node === '') {
    return false;
  }
  if (Array.isArray(node)) {
    return node.some(isRenderableNode);
  }
  return true;
}

export function hasRenderableChildren(element: JSX.Element): boolean {
  if (element == null || typeof element !== 'object') {
    return false;
  }
  const children = (element as { props?: { children?: JSX.Element } }).props?.children;
  return isRenderableNode(children as JSX.Element);
}
