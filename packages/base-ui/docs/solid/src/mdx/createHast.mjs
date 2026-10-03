import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';

/**
 * @param {string} markdown
 * @param {import('remark-rehype').Options} [options]
 */
export function createHast(markdown, options) {
  const processor = unified().use(remarkParse).use(remarkRehype, options);
  const mdast = processor.parse(markdown);
  return processor.runSync(mdast);
}
