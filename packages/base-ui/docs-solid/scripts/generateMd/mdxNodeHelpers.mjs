/**
 * Helpers for building MDX/Markdown AST nodes.
 *
 * Ported verbatim from `docs-react/scripts/generateLlmTxt/mdxNodeHelpers.mjs`.
 * Framework-agnostic — kept untouched for snapshot parity.
 */

export function text(value) {
  return {
    type: 'text',
    value: value || '',
  };
}

function normalizeChildren(children) {
  if (!children) {
    return [];
  }

  const childArray = Array.isArray(children) ? children : [children];

  return childArray.map((child) => (typeof child === 'string' ? text(child) : child));
}

export function paragraph(children) {
  return {
    type: 'paragraph',
    children: normalizeChildren(children),
  };
}

export function emphasis(children) {
  return {
    type: 'emphasis',
    children: normalizeChildren(children),
  };
}

export function strong(children) {
  return {
    type: 'strong',
    children: normalizeChildren(children),
  };
}

export function heading(depth, children) {
  return {
    type: 'heading',
    depth: depth || 1,
    children: normalizeChildren(children),
  };
}

export function code(value, lang) {
  return {
    type: 'code',
    lang: lang || null,
    value: value || '',
  };
}

export function inlineCode(value) {
  return {
    type: 'inlineCode',
    value: value || '',
  };
}

function tableCell(content) {
  return {
    type: 'tableCell',
    children: normalizeChildren(content),
  };
}

function tableRow(cells) {
  return {
    type: 'tableRow',
    children: cells.map((cell) => tableCell(cell)),
  };
}

export function table(headers, rows, alignment = null) {
  const align = headers.map((_, index) => {
    if (!alignment || !alignment[index]) {
      return null;
    }

    switch (alignment[index]) {
      case 'center':
        return 'center';
      case 'right':
        return 'right';
      default:
        return 'left';
    }
  });

  const headerRow = tableRow(headers);
  const dataRows = rows.map((row) => tableRow(row));

  return {
    type: 'table',
    align,
    children: [headerRow, ...dataRows],
  };
}

export function textContent(node) {
  if (!node) {
    return '';
  }

  if (typeof node === 'string') {
    return node;
  }

  if (node.type === 'text') {
    return node.value || '';
  }

  if (node.children && Array.isArray(node.children)) {
    return node.children.map(textContent).join('');
  }

  return '';
}
