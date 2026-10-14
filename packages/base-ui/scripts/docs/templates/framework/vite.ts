// What Next.js does for the React docs, as Vite plugins for the Solid docs. It reads the docs'
// `next.config.mjs` (generated from the React docs' one) and applies it:
// - `env`, as `process.env.*` defines;
// - the docs-infra loaders of its Turbopack rules (precomputed types, demos and sitemap), through a
//   webpack loader context;
// - its MDX options (`@next/mdx`), with Solid's JSX and the docs' MDX provider.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { createJiti } from 'jiti';
import mdx from '@mdx-js/rollup';
import picomatch from 'picomatch';
import type { Plugin } from 'vite';

type LoaderEntry = string | { loader: string; options?: Record<string, unknown> };
type PluginEntry = string | [string, unknown] | ((...args: unknown[]) => unknown);

interface NextConfig {
  env?: Record<string, string>;
  turbopack?: {
    rules?: Record<string, { loaders?: LoaderEntry[] }>;
    resolveAlias?: Record<string, string>;
  };
  webpack?: (config: WebpackConfig, options: Record<string, unknown>) => WebpackConfig;
}

interface MdxOptions {
  remarkPlugins?: PluginEntry[];
  rehypePlugins?: PluginEntry[];
}

interface WebpackRule {
  test?: RegExp;
  use?:
    Array<string | { loader?: string; options?: unknown }> | { loader?: string; options?: unknown };
}

interface WebpackConfig {
  module: { rules: WebpackRule[] };
  resolve: { alias: Record<string, string> };
  plugins: unknown[];
}

type Loader = (this: Record<string, unknown>, source: string) => unknown;

/** The docs' `next.config.mjs`. */
async function loadNextConfig(root: string): Promise<NextConfig> {
  const jiti = createJiti(path.join(root, 'next.config.mjs'), { alias: { docs: root } });
  const config = (await jiti.import(path.join(root, 'next.config.mjs'), {
    default: true,
  })) as NextConfig;
  return config;
}

/**
 * The options `@next/mdx` gives its MDX loader. It adds the loader in the config's `webpack`
 * function, as the rule for `.mdx` files.
 */
function mdxOptionsOf(config: NextConfig): MdxOptions {
  const webpackConfig = config.webpack?.(
    { module: { rules: [] }, resolve: { alias: {} }, plugins: [] },
    {
      defaultLoaders: { babel: 'babel-loader' },
      dev: true,
      isServer: false,
      buildId: 'vite',
      config,
    },
  );
  for (const rule of webpackConfig?.module.rules ?? []) {
    if (!rule.test?.test('page.mdx')) {
      continue;
    }
    for (const use of Array.isArray(rule.use) ? rule.use : [rule.use]) {
      if (typeof use === 'object' && use?.loader?.includes('mdx')) {
        return (use.options ?? {}) as MdxOptions;
      }
    }
  }
  throw new Error('next.config.mjs adds no MDX loader (`@next/mdx`)');
}

async function importPlugin(entry: PluginEntry, require: NodeRequire) {
  if (typeof entry === 'function') {
    return entry;
  }
  const [specifier, options] = Array.isArray(entry) ? entry : [entry, undefined];
  const file = path.isAbsolute(specifier) ? specifier : require.resolve(specifier);
  const module = await import(pathToFileURL(file).href);
  const plugin = module.default ?? module;
  return options === undefined ? plugin : [plugin, options];
}

/** Runs a webpack loader on a module, through the part of the loader context the loaders use. */
function runLoader(
  loader: Loader,
  options: Record<string, unknown> | undefined,
  source: string,
  file: string,
  query: string,
  root: string,
  addDependency: (file: string) => void,
) {
  return new Promise<string>((resolve, reject) => {
    let settled = false;
    const callback = (error: Error | null, result?: string | Buffer) => {
      settled = true;
      if (error) {
        reject(error);
      } else {
        resolve(String(result));
      }
    };
    const context = {
      resourcePath: file,
      resourceQuery: query ? `?${query}` : '',
      rootContext: root,
      getOptions: () => options ?? {},
      cacheable: () => {},
      addDependency,
      addContextDependency: addDependency,
      async: () => callback,
      callback,
    };
    Promise.resolve(loader.call(context, source)).then((result) => {
      if (!settled && result !== undefined) {
        resolve(String(result));
      }
    }, reject);
  });
}

export async function nextApp(root: string): Promise<Plugin[]> {
  const config = await loadNextConfig(root);
  const require = createRequire(path.join(root, 'package.json'));
  const rules = Object.entries(config.turbopack?.rules ?? {}).map(([pattern, rule]) => ({
    match: picomatch(pattern.replace(/^\.\//, ''), { dot: true }),
    loaders: rule.loaders ?? [],
  }));
  const loaderModules = new Map<string, Loader>();
  const loadLoader = async (specifier: string) => {
    let loader = loaderModules.get(specifier);
    if (!loader) {
      const module = await import(pathToFileURL(require.resolve(specifier)).href);
      loader = (module.default ?? module) as Loader;
      loaderModules.set(specifier, loader);
    }
    return loader;
  };

  const env: Plugin = {
    name: 'next-app:env',
    config() {
      const defines: Record<string, string> = {};
      for (const [key, value] of Object.entries(config.env ?? {})) {
        defines[`process.env.${key}`] = JSON.stringify(value);
      }
      return { define: defines };
    },
  };

  const loaders: Plugin = {
    name: 'next-app:docs-infra-loaders',
    enforce: 'pre',
    async transform(code, id) {
      const [file, query = ''] = id.split('?');
      if (!file.startsWith(root) || !fs.existsSync(file)) {
        return null;
      }
      const relative = path.relative(root, file).split(path.sep).join('/');
      const rule = rules.find((candidate) => candidate.match(relative));
      if (!rule) {
        return null;
      }
      let source = code;
      // Webpack runs a rule's loaders last to first.
      for (const entry of [...rule.loaders].reverse()) {
        const { loader: specifier, options } =
          typeof entry === 'string' ? { loader: entry, options: undefined } : entry;
        const loader = await loadLoader(specifier);
        source = await runLoader(loader, options, source, file, query, root, (dependency) =>
          this.addWatchFile(dependency),
        );
      }
      return { code: source, map: null };
    },
  };

  const mdxOptions = mdxOptionsOf(config);
  const [remarkPlugins, rehypePlugins] = await Promise.all([
    Promise.all((mdxOptions.remarkPlugins ?? []).map((entry) => importPlugin(entry, require))),
    Promise.all((mdxOptions.rehypePlugins ?? []).map((entry) => importPlugin(entry, require))),
  ]);
  const mdxPlugin: Plugin = {
    ...(mdx({
      jsxImportSource: '@solidjs/web',
      providerImportSource: 'docs/src/adapters/mdx',
      remarkPlugins: remarkPlugins as never,
      rehypePlugins: rehypePlugins as never,
    }) as Plugin),
    enforce: 'pre',
  };

  // Webpack writes a module's `import.meta.url` as its file URL, in the browser too, and docs-infra
  // names a demo, a types file or the sitemap by it. Asset URLs (`new URL(..., import.meta.url)`)
  // stay Vite's.
  const moduleUrls: Plugin = {
    name: 'next-app:import-meta-url',
    enforce: 'pre',
    transform(code, id) {
      const [file] = id.split('?');
      if (!file.startsWith(root) || file.includes(`${path.sep}node_modules${path.sep}`)) {
        return null;
      }
      if (!code.includes('import.meta.url')) {
        return null;
      }
      const url = JSON.stringify(pathToFileURL(file).href);
      const replaced = code.replace(/(new URL\([^()]*?,\s*)?import\.meta\.url/g, (match, asset) =>
        asset ? match : url,
      );
      return replaced === code ? null : { code: replaced, map: null };
    },
  };

  return [env, loaders, moduleUrls, mdxPlugin];
}
