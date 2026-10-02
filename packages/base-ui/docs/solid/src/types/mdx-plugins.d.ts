/* Ambient module decls for untyped JS rehype/remark plugins wired in app.config.ts.
   Upstream plugins ship as .mjs without .d.ts — MDX plugins are runtime-shape-checked
   by unified, so a loose Plugin-compatible signature is accurate. Kept as a script
   (no top-level import/export) so the `*.mjs` wildcard matches relative-path imports. */

declare module "*.mjs" {
  export const rehypeSlug: import("unified").Plugin
  export const rehypeConcatHeadings: import("unified").Plugin
  export const rehypeQuickNav: import("unified").Plugin
  export const rehypeSubtitle: import("unified").Plugin
  export const rehypeKbd: import("unified").Plugin
  export const rehypeReference: import("unified").Plugin
  export const demoHighlight: () => import("vite").Plugin
  const plugin: import("unified").Plugin
  export default plugin
}

declare module "remark-typography" {
  const plugin: import("unified").Plugin
  export default plugin
}

declare module "@stefanprobst/rehype-extract-toc" {
  const plugin: import("unified").Plugin
  export default plugin
}
