/// <reference types="gtag.js" />
/// <reference types="vite/client" />
// The React docs' root declarations (`docs/react/types.d.ts`), with Solid's JSX for MDX modules.

declare namespace NodeJS {
  interface ProcessEnv {
    BASE_URL: string;
    LIB_VERSION: string;
    SOURCE_CODE_REPO: string;
  }
}

declare module 'gtag.js';

declare module '*.mdx' {
  const MDXComponent: (props: Record<string, unknown>) => import('@solidjs/web').JSX.Element;
  export default MDXComponent;
}

declare module '*.css';
