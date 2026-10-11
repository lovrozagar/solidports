import { expect, describe, it } from 'vitest';
import { closest, getTarget } from './shadowDom';

describe('getTarget', () => {
  it('returns the composed-path target while the event is being dispatched', () => {
    const parent = document.createElement('div');
    const child = document.createElement('span');
    parent.appendChild(child);
    document.body.appendChild(parent);

    let target: EventTarget | null = null;
    parent.addEventListener('click', (event) => {
      target = getTarget(event);
    });
    child.dispatchEvent(new Event('click', { bubbles: true }));

    expect(target).toBe(child);
    parent.remove();
  });

  it('falls back to `target` once dispatch has completed', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);

    const event = new Event('click');
    element.dispatchEvent(event);

    expect(event.composedPath()).toHaveLength(0);
    expect(getTarget(event)).toBe(element);
    element.remove();
  });
});

describe('closest', () => {
  it('returns the node when it matches', () => {
    const node = document.createElement('button');
    node.setAttribute('aria-haspopup', 'menu');
    expect(closest(node, '[aria-haspopup]')).toBe(node);
  });

  it('returns a light-dom ancestor', () => {
    const host = document.createElement('div');
    host.setAttribute('data-rootownerid', 'root');
    const child = document.createElement('span');
    host.append(child);
    expect(closest(child, '[data-rootownerid]')).toBe(host);
  });

  it('returns null when nothing matches', () => {
    const node = document.createElement('span');
    expect(closest(node, '[aria-haspopup]')).toBeNull();
    expect(closest(null, '[aria-haspopup]')).toBeNull();
  });

  it('crosses a shadow root to the matching host', () => {
    const host = document.createElement('div');
    host.setAttribute('aria-haspopup', 'menu');
    const root = host.attachShadow({ mode: 'open' });
    const inner = document.createElement('span');
    root.append(inner);
    document.body.append(host);

    expect(closest(inner, '[aria-haspopup]')).toBe(host);
    host.remove();
  });

  it('follows an assigned slot', () => {
    const host = document.createElement('div');
    const root = host.attachShadow({ mode: 'open' });
    const slot = document.createElement('slot');
    slot.setAttribute('data-rootownerid', 'slot');
    root.append(slot);
    const assigned = document.createElement('span');
    host.append(assigned);
    document.body.append(host);

    expect(assigned.assignedSlot).toBe(slot);
    expect(closest(assigned, '[data-rootownerid]')).toBe(slot);
    host.remove();
  });
});
