// `@next/mdx` while the Vite plugin reads `next.config.mjs`: it keeps the MDX options on the
// config, where the plugin finds them.
export default function nextMdx({ options = {} } = {}) {
  return (config) => ({ ...config, mdxOptions: options });
}
