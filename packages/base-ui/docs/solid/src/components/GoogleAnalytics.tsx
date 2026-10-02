import type { ParentProps } from 'solid-js';
/* V1 no-op stub. Upstream wires GTM + GA + usePreference; deferred by spec.
   Children passthrough so call site in (docs) layout renders unchanged. */
export function GoogleAnalytics(props: ParentProps) {
  return <>{props.children}</>
}

export function useGoogleAnalytics() {
  return {
    trackEvent: () => {},
  }
}
