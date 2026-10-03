// @ts-check
import { toHtml } from 'hast-util-to-html';
import { toString } from 'hast-util-to-string';
import { visitParents } from 'unist-util-visit-parents';
import { createHast } from '../../mdx/createHast.mjs';
import { highlightInline } from '../../syntax-highlighting/prettylights.mjs';

const REACT_DOCS = /^https:\/\/base-ui\.com\/react\//;

/**
 * Renders a reference description (JSDoc markdown) to HTML at build time, as the React docs do
 * through their types pipeline: inline code, emphasis, links, and `<kbd>` keep their docs styling,
 * and fenced code renders as a highlighted code block.
 * A description that is a single paragraph renders inline, without the `<p>`.
 *
 * @param {string | undefined} markdown
 * @returns {string | undefined}
 */
export function descriptionToHtml(markdown) {
  if (!markdown) {
    return undefined;
  }

  const tree = createHast(markdown, { allowDangerousHtml: true });

  // Fenced code: the same markup as the MDX code blocks (CodeBlock.css), highlighted at build time.
  visitParents(tree, 'element', (node, ancestors) => {
    if (node.tagName !== 'pre') {
      return;
    }
    const code = node.children.find(
      (child) => child.type === 'element' && child.tagName === 'code',
    );
    const className = code && code.type === 'element' ? code.properties?.className : undefined;
    const language = Array.isArray(className)
      ? String(className.find((name) => String(name).startsWith('language-')) ?? '').slice(9)
      : '';
    const source = (code ? toString(code) : toString(node)).replace(/\n$/, '');
    const parent = ancestors[ancestors.length - 1];
    parent.children[parent.children.indexOf(node)] = {
      type: 'raw',
      value: `<div class="CodeBlockRoot"><pre class="CodeBlockPreInline CodeBlockPre"><code><span class="frame" data-frame-type="focus">${highlightInline(source, language || 'tsx')}</span></code></pre></div>`,
    };
  });

  visitParents(tree, 'element', (node) => {
    if (node.tagName === 'code') {
      node.properties = { ...node.properties, className: ['Code', 'MdCode'], dataInline: '' };
    } else if (node.tagName === 'a') {
      const href = String(node.properties?.href ?? '');
      node.properties = {
        ...node.properties,
        className: ['Link'],
        href: href.replace(REACT_DOCS, '/solid/'),
      };
    }
  });

  // Raw `<kbd>` from JSDoc passes through as HTML; give it the docs class.
  visitParents(tree, 'raw', (node) => {
    node.value = node.value.replace(/<kbd>/g, '<kbd class="Kbd">');
  });

  const children = tree.children.filter((child) => child.type !== 'text' || child.value.trim());
  const content =
    children.length === 1 && children[0].type === 'element' && children[0].tagName === 'p'
      ? children[0].children
      : children;

  return toHtml(/** @type {any} */ ({ type: 'root', children: content }), {
    allowDangerousHtml: true,
  });
}

/**
 * Adds `descriptionHtml` next to each entry's `description`.
 *
 * @template {Record<string, { description?: string }>} T
 * @param {T} entries
 * @returns {T}
 */
export function withDescriptionHtml(entries) {
  return /** @type {T} */ (
    Object.fromEntries(
      Object.entries(entries).map(([key, entry]) => [
        key,
        { ...entry, descriptionHtml: descriptionToHtml(entry.description) },
      ]),
    )
  );
}
