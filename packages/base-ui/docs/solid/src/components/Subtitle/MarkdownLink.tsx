import { createMemo } from 'solid-js';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { MarkdownIcon } from '../../icons/MarkdownIcon';

export function MarkdownLink() {
  const pathname = usePathname();
  const markdownUrl = createMemo(() => `${pathname()}.md`);
  return (
    <>
      {/* Hoisted to <head> by React so crawlers and AI agents discover the Markdown twin */}
      <link rel="alternate" type="text/markdown" href={markdownUrl()} />
      <a
        href={markdownUrl()}
        class="SubtitleLink"
        aria-label="View markdown source"
        rel="alternate"
        type="text/markdown"
      >
        <span class="SubtitleLinkText">
          <MarkdownIcon />
          View as Markdown
        </span>
      </a>
    </>
  );
}
