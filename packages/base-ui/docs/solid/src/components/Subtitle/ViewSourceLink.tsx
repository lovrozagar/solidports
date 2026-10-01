import { useLocation } from "@solidjs/router"
import { GitHubIcon } from "../../icons/GitHubIcon"

const SOURCE_CODE_REPO = "https://github.com/mui/base-ui"
const SOURCE_CODE_REF = "v1.8.0"
const SOURCE_PATH_PREFIXES = ["/solid/components/", "/solid/utils/"] as const

function getSourceUrl(pathname: string) {
  const sourcePathPrefix = SOURCE_PATH_PREFIXES.find((prefix) => pathname.startsWith(prefix))
  if (sourcePathPrefix == null) return null
  const sourceSlug = pathname.slice(sourcePathPrefix.length).split("/").filter(Boolean)
  if (sourceSlug.length !== 1) return null
  return `${SOURCE_CODE_REPO}/tree/${SOURCE_CODE_REF}/packages/solid/src/${sourceSlug[0]}`
}

export function ViewSourceLink() {
  const location = useLocation()
  const sourceUrl = () => getSourceUrl(location.pathname)
  return (
    <>
      {sourceUrl() ? (
        <a
          href={sourceUrl()!}
          class="SubtitleLink"
          aria-label="View source on GitHub"
          target="_blank"
          rel="noopener noreferrer"
        >
          <span class="SubtitleLinkText">
            <GitHubIcon width="16" height="16" />
            View source
          </span>
        </a>
      ) : null}
    </>
  )
}
