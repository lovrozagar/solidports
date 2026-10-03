import { isServer, useHead } from '@solidjs/web';
import type { CSPContextValue } from '../csp-provider/CSPContext';

const DISABLE_SCROLLBAR_CLASS_NAME = 'base-ui-disable-scrollbar';

export const styleDisableScrollbar = {
  class: DISABLE_SCROLLBAR_CLASS_NAME,
};

/**
 * The page's CSP nonce for elements created in the browser. Solid's client `useHead` does not apply
 * one (a server render applies its own), so without it a style first mounted after navigation is
 * blocked under a nonce-based `style-src`. Read from the `csp-nonce` meta convention (Vite:
 * `property`, frameworks such as Flare: `name`); `content` is the readable copy, since browsers hide
 * the `nonce` attribute after parsing.
 */
function getDocumentNonce(): string | undefined {
  if (isServer) {
    return undefined;
  }
  const meta = document.querySelector<HTMLMetaElement>(
    'meta[property="csp-nonce"], meta[name="csp-nonce"]',
  );
  return meta?.nonce || meta?.content || undefined;
}

/**
 * Hoists the shared disable-scrollbar rule into `<head>`, as React's
 * `<style href precedence>` does. A `<style>` with an `href` is a head resource in Solid 2: it is
 * deduplicated by `href`, emitted in the server-rendered head (with the render's CSP nonce unless
 * one is given here), adopted on hydration, and kept for the page's lifetime.
 */
export function useStyleDisableScrollbar(csp: CSPContextValue) {
  useHead(() => {
    if (csp.disableStyleElements()) {
      return [];
    }
    const nonce = csp.nonce() ?? getDocumentNonce();
    return {
      tag: 'style',
      props: {
        href: DISABLE_SCROLLBAR_CLASS_NAME,
        ...(nonce ? { nonce } : null),
        children: `.${DISABLE_SCROLLBAR_CLASS_NAME}{scrollbar-width:none}.${DISABLE_SCROLLBAR_CLASS_NAME}::-webkit-scrollbar{display:none}`,
      },
    };
  });
}
