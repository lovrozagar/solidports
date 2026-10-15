import { createSitemap } from '@mui/internal-docs-infra/createSitemap';
import Overview from '../(docs)/solid/overview/page.mdx';
import Handbook from '../(docs)/solid/handbook/page.mdx';
import Components from '../(docs)/solid/components/page.mdx';
import Utils from '../(docs)/solid/utils/page.mdx';

export const sitemap = createSitemap(import.meta.url, {
  Overview,
  Handbook,
  Components,
  Utils,
});
