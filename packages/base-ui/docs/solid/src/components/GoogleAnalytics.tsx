import { createMemo } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { usePathname } from 'docs/src/adapters/next/navigation';
import { usePreference } from '@mui/internal-docs-infra/usePreference';
import { GoogleAnalyticsProvider } from 'docs/src/blocks/GoogleAnalyticsProvider';
import { GoogleTagManager } from '../blocks/GoogleTagManager';

const PRODUCTION_GA =
  process.env.DEPLOY_ENV === 'production' || process.env.DEPLOY_ENV === 'staging';
const GOOGLE_ANALYTICS_ID_V4 = PRODUCTION_GA ? 'G-FE5XQBD0BH' : 'G-LSE9X5R2CN';
export function GoogleAnalytics(props: { children?: JSX.Element }) {
  const currentRoute = usePathname();
  const _usePreference = usePreference(
    () => 'variant',
    () => 'CssModules:Tailwind',
    () => 'CssModules',
  );
  const _usePreference2 = createMemo(() => {
    const [stylingVariant] = _usePreference();
    return {
      stylingVariant,
    };
  });
  return (
    <>
      <GoogleTagManager id={GOOGLE_ANALYTICS_ID_V4} />
      <GoogleAnalyticsProvider
        id={GOOGLE_ANALYTICS_ID_V4}
        productId="base-ui"
        productCategoryId="core"
        currentRoute={currentRoute()}
        codeLanguage="ts"
        codeStylingVariant={_usePreference2().stylingVariant}
        userLanguage="en"
      >
        {props.children}
      </GoogleAnalyticsProvider>
    </>
  );
}
