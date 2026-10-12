type Listener = () => void;

interface LabelObserver {
  observer: MutationObserver;
  listeners: Set<Listener>;
}

const observers = new WeakMap<Node, LabelObserver>();

function isLabel(node: Node): boolean {
  return (node as Element).localName === 'label';
}

function containsLabel(nodes: NodeList): boolean {
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    if (
      node.nodeType === 1 &&
      (isLabel(node) || (node as Element).getElementsByTagName('label').length > 0)
    ) {
      return true;
    }
  }
  return false;
}

function changesLabels(record: MutationRecord): boolean {
  if (record.type === 'attributes') {
    return isLabel(record.target);
  }
  return containsLabel(record.addedNodes) || containsLabel(record.removedNodes);
}

/**
 * Solid: React re-resolves a control's DOM label fallback after every commit, so a `<label>`
 * mounting or unmounting is picked up when the control re-renders with it. Solid has no commit
 * to hook, so the fallback watches the control's tree instead: `listener` runs after a `<label>`
 * is added to or removed from `root`, or a label's `for` changes. One observer serves every
 * control in a tree while any of them listens. Returns the unsubscribe function.
 */
export function observeLabels(root: Node, listener: Listener): () => void {
  let entry = observers.get(root);
  if (!entry) {
    const listeners = new Set<Listener>();
    entry = {
      listeners,
      observer: new MutationObserver((records) => {
        if (records.some(changesLabels)) {
          Array.from(listeners).forEach((notify) => notify());
        }
      }),
    };
    observers.set(root, entry);
  }

  const current = entry;
  if (current.listeners.size === 0) {
    current.observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['for'],
    });
  }
  current.listeners.add(listener);

  return () => {
    if (current.listeners.delete(listener) && current.listeners.size === 0) {
      current.observer.disconnect();
    }
  };
}
