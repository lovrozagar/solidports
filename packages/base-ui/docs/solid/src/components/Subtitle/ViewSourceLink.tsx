import { createMemo } from 'solid-js';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { GitHubIcon } from '../../icons/GitHubIcon';

const SOURCE_CODE_REPO = process.env.SOURCE_CODE_REPO;
const SOURCE_CODE_REF = process.env.LIB_VERSION ? `v${process.env.LIB_VERSION}` : undefined;
const SOURCE_PATH_PREFIXES = ['/solid/components/', '/solid/utils/'] as const;
function getSourceUrl(pathname: string) {
  const sourcePathPrefix = SOURCE_PATH_PREFIXES.find((prefix) => pathname.startsWith(prefix));
  if (sourcePathPrefix == null) {
    return null;
  }
  const sourceSlug = pathname.slice(sourcePathPrefix.length).split('/').filter(Boolean);
  if (sourceSlug.length !== 1) {
    return null;
  }
  if (SOURCE_CODE_REPO == null || SOURCE_CODE_REF == null) {
    return null;
  }
  return `${SOURCE_CODE_REPO}/tree/${SOURCE_CODE_REF}/packages/solid/src/${sourceSlug[0]}`;
}
export function ViewSourceLink() {
  const pathname = usePathname();
  const sourceUrl = createMemo(() => getSourceUrl(pathname()));
  const _render = createMemo(() => {
    const _sourceUrl = sourceUrl();
    if (_sourceUrl == null) {
      return null;
    }
    return (
      <a
        href={_sourceUrl}
        class="SubtitleLink"
        aria-label="View source on GitHub"
        target="_blank"
        rel="noopener noreferrer"
      >
        <span class="SubtitleLinkText">
          <GitHubIcon />
          View source
        </span>
      </a>
    );
  });
  return <>{_render()}</>;
}
