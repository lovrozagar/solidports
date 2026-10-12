import type { FloatingNodeType } from '../types';

/* eslint-disable @typescript-eslint/no-loop-func */

export function getNodeChildren(
  nodes: Array<FloatingNodeType>,
  id: string | null | undefined,
  onlyOpenChildren = true,
): Array<FloatingNodeType> {
  const directChildren = nodes.filter((node) => node.parentId === id);

  /* recursive tree flatten — flatMap with spread is intentional here */
  // eslint-disable-next-line oxc/no-map-spread
  return directChildren.flatMap((child) => [
    ...(!onlyOpenChildren || child.context?.open() ? [child] : []),
    ...getNodeChildren(nodes, child.id, onlyOpenChildren),
  ]);
}
export function getNodeAncestors(nodes: Array<FloatingNodeType>, id: string | undefined) {
  let allAncestors: Array<FloatingNodeType> = [];
  let currentParentId = nodes.find((node) => node.id === id)?.parentId;

  while (currentParentId) {
    const currentNode = nodes.find((node) => node.id === currentParentId);
    currentParentId = currentNode?.parentId;

    if (currentNode) {
      allAncestors = allAncestors.concat(currentNode);
    }
  }

  return allAncestors;
}
