import { flush } from 'solid-js';
import { hydrate, render } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { inject, vi } from 'vitest';

// jsdom has no ResizeObserver; the docs' scroll areas observe their viewport with it.
globalThis.ResizeObserver ??= class {
  observe() {}

  unobserve() {}

  disconnect() {}
};

// jsdom has no IntersectionObserver either; nothing scrolls into view in it.
globalThis.IntersectionObserver ??= class {
  readonly root = null;

  readonly rootMargin = '';

  readonly thresholds = [];

  observe() {}

  unobserve() {}

  disconnect() {}

  takeRecords() {
    return [];
  }
} as unknown as typeof IntersectionObserver;

// jsdom runs no animations and has no `getAnimations`; Base UI waits on running animations.
Element.prototype.getAnimations ??= () => [];

// Node's own `localStorage` global (undefined without `--localstorage-file`) hides jsdom's.
if (typeof localStorage === 'undefined') {
  const items = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => items.set(key, String(value)),
      removeItem: (key: string) => items.delete(key),
      clear: () => items.clear(),
    },
  });
}

export interface Hydrated {
  container: HTMLElement;
  /** Server-rendered elements hydration did not claim: each one is a hydration key miss. */
  unclaimed: Element[];
  /** Hydration warnings Solid logged (key misses and mismatches). */
  warnings: string[];
  dispose: () => void;
}

async function settle() {
  flush();
  await new Promise((done) => {
    setTimeout(done, 0);
  });
  flush();
}

/** The server HTML `__fixtures__/globalSetup.ts` rendered for an entry (its path under `src`). */
export function serverHtml(entry: string): string {
  const html = inject('docsServerHtml')[entry];
  if (html == null) {
    throw new Error(`globalSetup did not server-render ${entry}`);
  }
  return html;
}

/** Hydrates an entry's server HTML with `app`, as the docs' client does. */
export async function hydrateEntry(entry: string, app: () => JSX.Element): Promise<Hydrated> {
  const container = document.createElement('div');
  container.innerHTML = serverHtml(entry);
  document.body.append(container);
  const claimed = new WeakSet<Node>();
  const completed = new WeakSet<Node>();
  const add = completed.add.bind(completed);
  completed.add = (node: Node) => {
    claimed.add(node);
    return add(node);
  };
  (window as unknown as { _$HY: object })._$HY = {
    completed,
    done: false,
    events: [],
    fe() {},
    r: {},
  };
  const warnings: string[] = [];
  const warn = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
    const message = args.map(String).join(' ');
    if (/hydrat/i.test(message)) {
      warnings.push(message);
    }
  });
  let dispose: () => void;
  try {
    dispose = hydrate(app, container);
    await settle();
  } finally {
    warn.mockRestore();
  }
  const unclaimed = [...container.querySelectorAll('[_hk]')].filter(
    (element) => !claimed.has(element),
  );
  return {
    container,
    unclaimed,
    warnings,
    dispose: () => {
      dispose();
      container.remove();
    },
  };
}

/**
 * Renders `app` on the client alone, for comparing its markup with the server's: its first render,
 * before any timer (an idle highlight swap) runs.
 */
export function renderClient(app: () => JSX.Element) {
  const container = document.createElement('div');
  document.body.append(container);
  const dispose = render(app, container);
  flush();
  return {
    container,
    dispose: () => {
      dispose();
      container.remove();
    },
  };
}

const GENERATED_ID_ATTRIBUTES = new Set([
  'id',
  'for',
  'data-id',
  'aria-controls',
  'aria-labelledby',
  'aria-describedby',
]);

/**
 * A render's markup as one line per element and text node, in a form both a server and a client
 * render print the same way: no hydration keys or markers, sorted attributes, styles as the
 * browser reads them, and generated ids blanked (the server derives them from hydration keys, a
 * client render from a counter).
 */
export function normalizeMarkup(html: string): string[] {
  const template = document.createElement('template');
  template.innerHTML = html;
  const lines: string[] = [];
  const walk = (node: Node, depth: number) => {
    const indent = '  '.repeat(depth);
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/\u00a0/g, ' ');
      if (text.trim()) {
        lines.push(`${indent}${JSON.stringify(text)}`);
      }
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return;
    }
    const element = node as HTMLElement;
    if (element.localName === 'script') {
      return;
    }
    const attributes = [...element.attributes]
      .filter((attribute) => attribute.name !== '_hk')
      .map((attribute) => {
        if (attribute.name === 'style') {
          return `style="${element.style.cssText}"`;
        }
        const value = GENERATED_ID_ATTRIBUTES.has(attribute.name) ? '' : attribute.value;
        return `${attribute.name}="${value}"`;
      })
      .sort();
    lines.push(`${indent}<${element.localName}${attributes.map((a) => ` ${a}`).join('')}>`);
    const children = element.localName === 'template' ? (element as HTMLTemplateElement).content : element;
    children.childNodes.forEach((child) => walk(child, depth + 1));
  };
  template.content.childNodes.forEach((child) => walk(child, 0));
  return lines;
}
