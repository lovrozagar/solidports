/**
 * `<Demo path="checkbox-group/hero" />` -> markdown sections per variant.
 *
 * Solid layout differs from React:
 *   `src/demos/solid/<path>/<variant>/...files`
 * where <variant> is `css-modules` (preferred / first) and `tailwind`.
 *
 * Output mirrors the React snapshot: one `## Demo` heading, then one `### <Title>`
 * subsection per variant, each followed by fenced blocks for every file in the
 * variant directory. CSS Modules variant lists `index.module.css` first (matches
 * React's `firstFile` ordering).
 */

import fs from 'fs/promises';
import path from 'path';
import * as mdx from './mdxNodeHelpers.mjs';

const DEMOS_ROOT_FROM_PROJECT = 'src/demos/solid';

const VARIANTS = [
  {
    dir: 'tailwind',
    title: 'Tailwind',
    description: 'This example shows how to implement the component using Tailwind CSS.',
    firstFile: null,
  },
  {
    dir: 'css-modules',
    title: 'CSS Modules',
    description: 'This example shows how to implement the component using CSS Modules.',
    firstFile: 'index.module.css',
  },
];

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');

/**
 * Walk a demo variant directory and return all source files (recursive).
 */
async function readVariantFiles(variantDir) {
  /** @type {Array<{ fileName: string, content: string, extension: string }>} */
  const files = [];

  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(abs, rel);
        continue;
      }
      const content = await fs.readFile(abs, 'utf-8');
      files.push({
        fileName: rel,
        content,
        extension: path.extname(entry.name).slice(1),
      });
    }
  }

  await walk(variantDir, '');
  return files;
}

function reorderFirstFile(files, firstFile) {
  if (!firstFile) {
    return files;
  }
  const idx = files.findIndex((f) => f.fileName === firstFile);
  if (idx <= 0) {
    return files;
  }
  const [head] = files.splice(idx, 1);
  return [head, ...files];
}

/**
 * @param {string} _mdxFilePath unused — Solid demo paths are absolute under src/demos/solid
 * @param {string} demoPath e.g. "checkbox-group/hero"
 */
export async function processDemo(_mdxFilePath, demoPath) {
  const baseDir = path.join(PROJECT_ROOT, DEMOS_ROOT_FROM_PROJECT, demoPath);

  let baseExists = false;
  try {
    const stat = await fs.stat(baseDir);
    baseExists = stat.isDirectory();
  } catch {
    baseExists = false;
  }

  if (!baseExists) {
    /* eslint-disable-next-line no-console */
    console.warn(`[generateMd] Demo directory not found: ${baseDir}`);
    return [
      mdx.heading(2, 'Demo'),
      mdx.paragraph([mdx.emphasis(`Demo "${demoPath}" not yet ported.`)]),
    ];
  }

  const result = [mdx.heading(2, 'Demo')];

  for (const variant of VARIANTS) {
    const variantDir = path.join(baseDir, variant.dir);
    let exists = false;
    try {
      const stat = await fs.stat(variantDir);
      exists = stat.isDirectory();
    } catch {
      exists = false;
    }

    if (!exists) {
      continue;
    }

    let files = await readVariantFiles(variantDir);
    if (files.length === 0) {
      continue;
    }
    files = reorderFirstFile(files, variant.firstFile);

    result.push(mdx.heading(3, variant.title));
    result.push(mdx.paragraph(variant.description));

    for (const { fileName, content, extension } of files) {
      const commentedContent = `/* ${fileName} */\n${content}`;
      result.push(mdx.code(commentedContent, extension || null));
    }
  }

  if (result.length === 1) {
    /* No variants found at all — leave a stub instead of an empty Demo heading. */
    result.push(mdx.paragraph([mdx.emphasis(`No variants found for demo "${demoPath}".`)]));
  }

  return result;
}
