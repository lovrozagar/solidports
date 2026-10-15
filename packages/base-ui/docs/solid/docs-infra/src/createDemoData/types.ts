import type { JSX } from '@solidjs/web';
import type { ComponentType } from 'docs/src/adapters/react';
import type { Code } from '../CodeHighlighter/types';

export type CreateDemoDataMeta = {
  name?: string;
  slug?: string;
  displayName?: string;
  skipPrecompute?: boolean;
  precompute?: Code;
  loadPrecompute?: () => Promise<Code>;
  client?: ComponentType<{
    children: JSX.Element;
  }>;
};
export type DemoData<T extends ComponentType<any> = ComponentType> = {
  name: string;
  slug: string;
  displayName: string;
  precompute: Code | undefined;
  loadPrecompute: (() => Promise<Code>) | undefined;
  url: string;
  components: {
    [key: string]: T;
  };
};
export type DemoGlobalProvider = ComponentType<{
  children: JSX.Element;
}>;
export type DemoGlobalData = DemoData<DemoGlobalProvider>;
