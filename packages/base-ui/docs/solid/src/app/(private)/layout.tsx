import { Head } from 'docs/src/adapters/next/document';
import type { ParentProps } from 'solid-js';
import type { Metadata, Viewport } from 'docs/src/adapters/next';

export default function Layout(props: ParentProps) {
  return (
    // Use suppressHydrationWarning to avoid https://github.com/react/react/issues/24430
    <html lang="en">
      <Head />
      <body>{props.children}</body>
    </html>
  );
}
export const viewport: Viewport = {
  initialScale: 1,
  width: 'device-width',
};
export const metadata: Metadata = {
  title: {
    template: '%s · Base UI',
    default: 'Base UI',
  },
  twitter: {
    site: '@base_ui',
    card: 'summary_large_image',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    title: {
      template: '%s · Base UI',
      default: 'Base UI',
    },
    ttl: 604800,
  },
  icons: {
    // Based on https://evilmartians.com/chronicles/how-to-favicon-in-2021-six-files-that-fit-most-needs
    icon: [
      {
        rel: 'icon',
        url:
          process.env.NODE_ENV !== 'production' ? '/static/favicon-dev.ico' : '/static/favicon.ico',
        sizes: '32x32',
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        url:
          process.env.NODE_ENV !== 'production' ? '/static/favicon-dev.svg' : '/static/favicon.svg',
      },
    ],
    apple: [
      {
        rel: 'apple-touch-icon',
        url: '/static/apple-touch-icon.png',
      },
    ],
  },
  robots: {
    index: false,
    follow: false,
  },
};
