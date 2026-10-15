// The document head of a Next root layout: Next writes the charset and its own scripts into the
// `<head>` a layout renders; Solid's server render needs the hydration script there. The route
// segments write their `metadata` with `useHead` (see `framework/metadata.ts`).
import { omit } from 'solid-js';
import { HydrationScript } from '@solidjs/web';
import type { JSX } from '@solidjs/web';

export function Head(props: JSX.HTMLAttributes<HTMLHeadElement>) {
  const rest = omit(props, 'children');
  return (
    <head {...rest}>
      <meta charset="utf-8" />
      {props.children}
      <HydrationScript />
    </head>
  );
}
