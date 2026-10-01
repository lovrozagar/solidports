/**
 * Inline `<PropsReferenceTable data={...}>` -> markdown table.
 *
 * Ported from React script — reads the static-evaluated estree off the JSX
 * attribute and emits a Prop/Type/Default/Description table.
 */

import { unified } from 'unified';
import remarkParse from 'remark-parse';
import * as mdx from './mdxNodeHelpers.mjs';

function parseMarkdown(markdown) {
  const processor = unified().use(remarkParse);
  const result = processor.parse(markdown);
  return result.children;
}

function convertEstreeToObject(estree) {
  if (!estree || !estree.body || !estree.body[0] || !estree.body[0].expression) {
    throw new Error('Invalid estree structure - missing expression');
  }

  const expression = estree.body[0].expression;
  return convertExpressionNode(expression);
}

function convertExpressionNode(node) {
  if (!node || !node.type) {
    throw new Error('Invalid expression node - missing type');
  }

  switch (node.type) {
    case 'ObjectExpression': {
      const obj = {};
      for (const prop of node.properties) {
        if (prop.type !== 'Property') {
          throw new Error(`Unsupported property type: ${prop.type}`);
        }

        let key;
        if (prop.key.type === 'Identifier') {
          key = prop.key.name;
        } else if (prop.key.type === 'Literal') {
          key = prop.key.value;
        } else {
          throw new Error(`Unsupported key type: ${prop.key.type}`);
        }

        obj[key] = convertExpressionNode(prop.value);
      }
      return obj;
    }
    case 'ArrayExpression':
      return node.elements.map((element) => convertExpressionNode(element));

    case 'Literal':
      return node.value;

    case 'TemplateLiteral':
      if (node.quasis.length === 1 && node.expressions.length === 0) {
        return node.quasis[0].value.raw;
      }
      return node.quasis.map((q) => q.value.raw).join('…');

    case 'Identifier':
      return node.name;

    default:
      throw new Error(`Unsupported expression type: ${node.type}`);
  }
}

export function processPropsReferenceTable(node) {
  const dataAttr = node.attributes?.find((attr) => attr.name === 'data');
  const typeAttr = node.attributes?.find((attr) => attr.name === 'type')?.value || 'props';

  if (!dataAttr) {
    throw new Error('PropsReferenceTable: No data provided');
  }

  let propsData = {};

  if (dataAttr.type === 'mdxJsxAttribute' && dataAttr.value) {
    try {
      if (
        dataAttr.value.type === 'mdxJsxAttributeValueExpression' &&
        dataAttr.value.data &&
        dataAttr.value.data.estree
      ) {
        propsData = convertEstreeToObject(dataAttr.value.data.estree);
      } else {
        throw new Error('PropsReferenceTable data must be a static JavaScript object');
      }
    } catch (err) {
      throw new Error(`Error processing PropsReferenceTable data: ${err.message}`);
    }
  } else {
    throw new Error('PropsReferenceTable data attribute must be a valid JSX attribute');
  }

  const tables = [];

  const heading = typeAttr === 'return' ? 'Return Value' : 'Props';
  tables.push(mdx.paragraph([mdx.strong(`${heading}:`)]));

  const propsRows = Object.entries(propsData).map(([propName, propDef]) => {
    const row = [propName, propDef.type ? mdx.inlineCode(propDef.type) : '-'];

    if (typeAttr === 'props') {
      row.push(propDef.default ? mdx.inlineCode(propDef.default) : '-');
    }

    row.push(parseMarkdown(propDef.description || '-'));

    return row;
  });

  const headers =
    typeAttr === 'props'
      ? ['Prop', 'Type', 'Default', 'Description']
      : ['Property', 'Type', 'Description'];

  const alignments =
    typeAttr === 'props' ? ['left', 'left', 'left', 'left'] : ['left', 'left', 'left'];

  const tableNode = mdx.table(headers, propsRows, alignments);
  tables.push(tableNode);

  return tables;
}
