/**
 * MDX -> markdown for the Solid docs site.
 *
 * Mirrors `docs-react/scripts/generateLlmTxt/mdxToMarkdown.mjs` but with
 * Solid-specific JSX shortcode handling:
 *   - `<Demo path="comp/variant" />` is the JSX node itself, not an import
 *     (React docs use a separate `import Demo from './demos/...'` pattern).
 *   - Extra Solid-only shortcodes are accepted (Callout, QuickNav, ReleaseTimeline).
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import { visit } from 'unist-util-visit';
import { processReference } from './referenceProcessor.mjs';
import { processDemo } from './demoProcessor.mjs';
import { processPropsReferenceTable } from './propsReferenceTableProcessor.mjs';
import * as mdx from './mdxNodeHelpers.mjs';
import { resolveMdLinks } from './resolver.mjs';

function getStringAttr(node, name) {
  const attr = node.attributes?.find((a) => a.name === name);
  if (!attr) {
    return undefined;
  }
  if (typeof attr.value === 'string') {
    return attr.value;
  }
  if (attr.value && typeof attr.value === 'object' && typeof attr.value.value === 'string') {
    return attr.value.value;
  }
  return undefined;
}

function extractMetadata() {
  return (tree, file) => {
    file.data.metadata = {
      title: '',
      subtitle: '',
      description: '',
    };

    visit(tree, 'heading', (node) => {
      if (node.depth === 1 && node.children?.[0]?.value && !file.data.metadata.title) {
        file.data.metadata.title = mdx.textContent(node);
      }
    });

    visit(tree, ['mdxJsxFlowElement', 'mdxFlowExpression', 'mdxJsxTextElement'], (node) => {
      if (node.name === 'Subtitle') {
        file.data.metadata.subtitle = mdx.textContent(node);
      } else if (node.name === 'Meta') {
        const nameAttr = node.attributes?.find(
          (attr) => attr.name === 'name' && attr.value === 'description',
        );
        const contentAttr = node.attributes?.find((attr) => attr.name === 'content');

        if (nameAttr && contentAttr) {
          file.data.metadata.description =
            typeof contentAttr.value === 'string' ? contentAttr.value : contentAttr.value?.value;
        }
      }
    });

    return tree;
  };
}

const KNOWN_BLOCK_TAGS = new Set([
  'a',
  'abbr',
  'b',
  'br',
  'code',
  'del',
  'details',
  'em',
  'i',
  'img',
  'kbd',
  'mark',
  's',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'time',
]);

function transformJsx() {
  return async (tree, file) => {
    const demosToProcess = [];
    const unknownComponents = new Set();

    visit(
      tree,
      [
        'mdxJsxFlowElement',
        'mdxjsEsm',
        'mdxFlowExpression',
        'mdxTextExpression',
        'mdxJsxTextElement',
      ],
      (node, index, parent) => {
        if (node.type === 'mdxjsEsm') {
          if (node.data?.estree?.type === 'Program') {
            const body = node.data.estree.body[0];
            if (body?.type === 'ExportNamedDeclaration') {
              const declaration = body.declaration;
              if (
                declaration?.type === 'VariableDeclaration' &&
                declaration.declarations?.[0]?.id?.name === 'metadata'
              ) {
                parent.children.splice(index, 1);
                return [visit.SKIP, index];
              }
            }
          }
          return undefined;
        }

        if (node.type === 'mdxFlowExpression' || node.type === 'mdxTextExpression') {
          /* Drop bare JS expressions in the markdown stream — usually inline JSX
             helpers that have no markdown analog. */
          parent.children.splice(index, 1);
          return [visit.SKIP, index];
        }

        if (node.name === 'Demo') {
          const demoPath = getStringAttr(node, 'path');
          if (!demoPath) {
            parent.children.splice(index, 1);
            return [visit.SKIP, index];
          }
          demosToProcess.push({ index, parent, demoPath });
          return undefined;
        }

        switch (node.name) {
          case 'Reference': {
            const tables = processReference(node);
            parent.children.splice(index, 1, ...tables);
            return visit.CONTINUE;
          }

          case 'PropsReferenceTable': {
            const tables = processPropsReferenceTable(node);
            parent.children.splice(index, 1, ...tables);
            return visit.CONTINUE;
          }

          case 'Subtitle': {
            parent.children.splice(index, 1);
            return [visit.SKIP, index];
          }

          case 'ReleaseTimeline': {
            parent.children.splice(index, 1);
            return [visit.SKIP, index];
          }

          case 'Meta': {
            const nameAttr = node.attributes?.find(
              (attr) => attr.name === 'name' && attr.value === 'description',
            );
            const contentAttr = node.attributes?.find((attr) => attr.name === 'content');
            const descValue =
              contentAttr && typeof contentAttr.value === 'string'
                ? contentAttr.value
                : contentAttr?.value?.value;

            if (nameAttr && descValue) {
              parent.children.splice(index, 1, mdx.paragraph(descValue));
              return visit.CONTINUE;
            }

            parent.children.splice(index, 1);
            return [visit.SKIP, index];
          }

          case 'Callout': {
            /* Inline children as a blockquote-ish paragraph block. */
            const inner = node.children ?? [];
            parent.children.splice(index, 1, ...inner);
            return [visit.SKIP, index];
          }

          case 'QuickNav':
          case 'QuickNav.Root':
          case 'QuickNav.List':
          case 'QuickNav.Item':
          case 'QuickNav.Link':
          case 'QuickNav.Title': {
            /* Side-nav widget — no markdown analog. */
            parent.children.splice(index, 1);
            return [visit.SKIP, index];
          }

          case 'link': {
            parent.children.splice(index, 1);
            return [visit.SKIP, index];
          }

          default: {
            if (!node.name) {
              return visit.CONTINUE;
            }
            if (KNOWN_BLOCK_TAGS.has(node.name)) {
              return visit.CONTINUE;
            }

            /* Unported shortcode — log + emit a stub note instead of crashing.
               Keeps the build going so the user gets a full output. */
            unknownComponents.add(node.name);
            parent.children.splice(
              index,
              1,
              mdx.paragraph([mdx.emphasis(`<${node.name}/> not rendered in markdown output.`)]),
            );
            return visit.CONTINUE;
          }
        }
      },
    );

    const demoResults = await Promise.all(
      demosToProcess.map(async ({ demoPath }) => processDemo(file.path || '', demoPath)),
    );

    for (let i = demosToProcess.length - 1; i >= 0; i -= 1) {
      const { index, parent } = demosToProcess[i];
      parent.children.splice(index, 1, ...demoResults[i]);
    }

    if (unknownComponents.size > 0) {
      file.data.unknownComponents = Array.from(unknownComponents);
    }

    return tree;
  };
}

export async function mdxToMarkdown(mdxContent, mdxFilePath, { urlPath, urlsWithMdVersion } = {}) {
  const vfile = {
    path: mdxFilePath,
    value: mdxContent,
  };

  const file = await unified()
    .use(remarkParse)
    .use(remarkMdx)
    .use(remarkGfm)
    .use(extractMetadata)
    .use(transformJsx)
    .use(resolveMdLinks, { urlPath, urlsWithMdVersion })
    .use(remarkStringify, {
      bullet: '-',
      emphasis: '*',
      strong: '*',
      fence: '`',
      fences: true,
      listItemIndent: 'one',
      rule: '-',
      commonmark: true,
      gfm: true,
    })
    .process(vfile);

  const markdown = String(file);

  const { title = '', subtitle = '', description = '' } = file.data.metadata || {};
  const unknownComponents = file.data.unknownComponents || [];

  return {
    markdown,
    title,
    subtitle,
    description,
    unknownComponents,
  };
}
