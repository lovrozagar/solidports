/**
 * `<Reference component="X" parts="A, B" />` -> markdown tables.
 *
 * Solid port of the React script. JSON lookup follows
 * `src/components/ReferenceTable/rehypeReference.mjs`:
 *   1. try `${kebab(component)}-${kebab(part)}.json`
 *   2. fall back to `${kebab(part)}.json`
 *   3. missing file -> log + emit a stub heading (rehype skips silently;
 *      `.md` output keeps an explicit note so the gap is visible).
 */

import fs from 'fs';
import path from 'path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';

import * as mdx from './mdxNodeHelpers.mjs';
import {
  getAttributeValue,
  isComponentDef,
  isFunctionDef,
  normalizeReturnValue,
} from '../../src/components/ReferenceTable/referenceUtils.mjs';

function parseMarkdown(markdown) {
  const processor = unified().use(remarkParse);
  const result = processor.parse(markdown);
  return result.children;
}

function kebabCase(str) {
  return str
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

const PROJECT_ROOT = path.resolve(import.meta.dirname, '../..');
const REFERENCE_DIR = path.join(PROJECT_ROOT, 'reference/generated');

export function processReference(node) {
  const componentAttr = getAttributeValue(node, 'component');
  const nameAttr = getAttributeValue(node, 'name');
  const partsAttr = getAttributeValue(node, 'parts');
  const referenceName = componentAttr ?? nameAttr;

  if (!referenceName) {
    throw new Error('Missing "component" or "name" prop on the "<Reference />" component.');
  }

  const tables = [];
  const componentDefs = [];
  const missingParts = [];
  let functionDef = null;

  if (!partsAttr) {
    const filename = `${kebabCase(referenceName)}.json`;
    const filepath = path.join(REFERENCE_DIR, filename);

    if (!fs.existsSync(filepath)) {
      /* Mirror Solid rehypeReference: silently drop missing single-component refs.
         Emit a stub paragraph so .md readers see the gap. */
      tables.push(
        mdx.paragraph([
          mdx.emphasis(`Reference data for ${referenceName} is not yet generated.`),
        ]),
      );
      return tables;
    }

    const referenceDef = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    if (isFunctionDef(referenceDef) && !isComponentDef(referenceDef)) {
      functionDef = referenceDef;
    } else {
      componentDefs.push(referenceDef);
    }
  } else {
    const parts = partsAttr.split(/,\s*/).map((p) => p.trim());

    for (const part of parts) {
      let filename = `${kebabCase(referenceName)}-${kebabCase(part)}.json`;
      let filepath = path.join(REFERENCE_DIR, filename);

      if (!fs.existsSync(filepath)) {
        filename = `${kebabCase(part)}.json`;
        filepath = path.join(REFERENCE_DIR, filename);
      }

      if (!fs.existsSync(filepath)) {
        missingParts.push(part);
        componentDefs.push(null);
        continue;
      }

      componentDefs.push(JSON.parse(fs.readFileSync(filepath, 'utf-8')));
    }
  }

  if (functionDef) {
    if (functionDef.description) {
      tables.push(mdx.paragraph(parseMarkdown(functionDef.description)));
    }

    if (functionDef.parameters && Object.keys(functionDef.parameters).length > 0) {
      tables.push(mdx.paragraph([mdx.strong('Parameters:')]));

      const parameterRows = Object.entries(functionDef.parameters).map(([paramName, paramDef]) => {
        const displayName = paramDef.optional ? `${paramName}?` : paramName;
        return [
          displayName,
          paramDef.type ? mdx.inlineCode(paramDef.type) : '-',
          paramDef.default ? mdx.inlineCode(paramDef.default) : '-',
          parseMarkdown(paramDef.description || '-'),
        ];
      });

      tables.push(
        mdx.table(['Parameter', 'Type', 'Default', 'Description'], parameterRows, [
          'left',
          'left',
          'left',
          'left',
        ]),
      );
    }

    if (functionDef.returnValue) {
      tables.push(mdx.paragraph([mdx.strong('Return Value:')]));

      const returnData = normalizeReturnValue(functionDef.returnValue);

      const includeName = Object.keys(returnData).length > 1;
      const returnRows = Object.entries(returnData).map(([name, def]) => {
        const description = def.description || '';
        const namePrefix = includeName ? `${name}${description ? ': ' : ''}` : '';
        const descriptionText = description ? `${namePrefix}${description}` : namePrefix;
        return [def.type ? mdx.inlineCode(def.type) : '-', parseMarkdown(descriptionText || '-')];
      });

      tables.push(mdx.table(['Type', 'Description'], returnRows, ['left', 'left']));
    }

    return tables;
  }

  const partsList = partsAttr ? partsAttr.split(/,\s*/).map((p) => p.trim()) : [referenceName];

  componentDefs.forEach((def, idx) => {
    const part = partsList[idx];

    if (!def) {
      if (partsList.length > 1) {
        tables.push(mdx.heading(3, part));
      }
      tables.push(
        mdx.paragraph([mdx.emphasis(`Reference data for ${part} is not yet generated.`)]),
      );
      return;
    }

    if (partsList.length > 1) {
      tables.push(mdx.heading(3, part));
    }

    if (def.description) {
      tables.push(mdx.paragraph(parseMarkdown(def.description)));
    }

    if (Object.keys(def.props || {}).length > 0) {
      tables.push(mdx.paragraph([mdx.strong(`${part} Props:`)]));

      const propsRows = Object.entries(def.props).map(([propName, propDef]) => [
        propName,
        propDef.type ? mdx.inlineCode(propDef.type) : '-',
        propDef.default ? mdx.inlineCode(propDef.default) : '-',
        parseMarkdown(propDef.description || '-'),
      ]);

      tables.push(
        mdx.table(['Prop', 'Type', 'Default', 'Description'], propsRows, [
          'left',
          'left',
          'left',
          'left',
        ]),
      );
    }

    if (Object.keys(def.dataAttributes || {}).length > 0) {
      tables.push(mdx.paragraph([mdx.strong(`${part} Data Attributes:`)]));

      const attrRows = Object.entries(def.dataAttributes).map(([attrName, attrDef]) => [
        attrName,
        attrDef.type ? mdx.inlineCode(attrDef.type) : '-',
        parseMarkdown(attrDef.description || '-'),
      ]);

      tables.push(
        mdx.table(['Attribute', 'Type', 'Description'], attrRows, ['left', 'left', 'left']),
      );
    }

    if (Object.keys(def.cssVariables || {}).length > 0) {
      tables.push(mdx.paragraph([mdx.strong(`${part} CSS Variables:`)]));

      const cssRows = Object.entries(def.cssVariables).map(([varName, varDef]) => [
        varName,
        varDef.type ? mdx.inlineCode(varDef.type) : '-',
        varDef.default ? mdx.inlineCode(varDef.default) : '-',
        parseMarkdown(varDef.description || '-'),
      ]);

      tables.push(
        mdx.table(['Variable', 'Type', 'Default', 'Description'], cssRows, [
          'left',
          'left',
          'left',
          'left',
        ]),
      );
    }

    if (partsList.length > 1 && idx < partsList.length - 1) {
      tables.push(mdx.paragraph(''));
    }
  });

  if (missingParts.length > 0) {
    /* eslint-disable-next-line no-console */
    console.warn(
      `[generateMd] Missing reference JSON for ${referenceName} parts: ${missingParts.join(', ')}`,
    );
  }

  return tables;
}
