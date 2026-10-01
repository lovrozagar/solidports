import { useLocation } from "@solidjs/router"
import { MarkdownIcon } from "../../icons/MarkdownIcon"

export function MarkdownLink() {
  const location = useLocation()

  return (
    <a
      href={`${location.pathname}.md`}
      class="SubtitleLink"
      aria-label="View markdown source"
      /* `external` opts out of Solid Router's click intercept — `.md` URLs are static files in
         `public/`, not SPA routes; without this, router catches the click and shows blank. */
      rel="external alternate"
      type="text/markdown"
    >
      <span class="SubtitleLinkText">
        <MarkdownIcon />
        View as Markdown
      </span>
    </a>
  )
}
