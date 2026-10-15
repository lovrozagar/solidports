import type { ParentProps } from 'solid-js';
import Script from 'docs/src/adapters/next/script';

interface GoogleTagManagerProps {
  id: string;
}
export function GoogleTagManager(props: ParentProps<GoogleTagManagerProps>) {
  return (
    /**
     * A better alternative to <script async>, to delay its execution
     * https://developer.chrome.com/blog/script-component/
     */
    <Script
      strategy="afterInteractive"
      src={`https://www.googletagmanager.com/gtag/js?id=${props.id}`}
    />
  );
}
