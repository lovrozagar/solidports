import { createMemo, For } from 'solid-js';
import type { Sitemap } from '@mui/internal-docs-infra/useSearch/types';
import * as MobileNav from './MobileNav';
import { GitHubIcon } from '../icons/GitHubIcon';
import { NpmIcon } from '../icons/NpmIcon';
import { getDisplayTitle } from '../utils/getDisplayTitle';
import { getSitemapPageInfo, isSitemapPageVisible } from '../utils/sitemapPage';

interface MobileNavContentProps {
  sitemap: Sitemap | null;
}
export function MobileNavContent(props: MobileNavContentProps) {
  const _render = createMemo(() => {
    if (!props.sitemap) {
      return null;
    }
    return (
      <>
        <For each={Object.entries(props.sitemap.data)}>
          {([name, section]) => (
            <MobileNav.Section>
              <MobileNav.Heading>{name}</MobileNav.Heading>
              <MobileNav.List>
                <For each={section.pages.filter(isSitemapPageVisible)}>
                  {(page) => {
                    const _row = createMemo(() => {
                      const pageInfo = getSitemapPageInfo(section, page);
                      return (
                        <MobileNav.Item href={pageInfo.href} external={pageInfo.external}>
                          <span class="MobileNavLinkText">{getDisplayTitle(page.title)}</span>
                          <For each={pageInfo.badges}>
                            {(badge) => <MobileNav.Badge>{badge}</MobileNav.Badge>}
                          </For>
                        </MobileNav.Item>
                      );
                    });
                    return <>{_row()}</>;
                  }}
                </For>
              </MobileNav.List>
            </MobileNav.Section>
          )}
        </For>
        <MobileNav.Section>
          <MobileNav.Heading>Resources</MobileNav.Heading>
          <MobileNav.List>
            <MobileNav.Item href="https://www.npmjs.com/package/@solidports/base-ui">
              <NpmIcon />
              <span class="MobileNavResourceRow">
                <span class="MobileNavLinkText">npm package</span>
                <span class="MobileNavVersion">{process.env.LIB_VERSION}</span>
              </span>
            </MobileNav.Item>
            <MobileNav.Item href="https://github.com/mui/base-ui">
              <GitHubIcon />
              <span class="MobileNavLinkText">GitHub</span>
            </MobileNav.Item>
          </MobileNav.List>
        </MobileNav.Section>
      </>
    );
  });
  return <>{_render()}</>;
}
