import { readdirSync, statSync } from "node:fs"
import { join, relative, sep } from "node:path"

const ROUTES_DIR = join(process.cwd(), "src", "routes")

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const s = statSync(full)
    if (s.isDirectory()) walk(full, acc)
    else if (entry.endsWith(".mdx")) acc.push(full)
  }
  return acc
}

function toUrl(absPath: string): string {
  let rel = relative(ROUTES_DIR, absPath).split(sep).join("/")
  rel = rel.replace(/\.mdx$/, "")
  /* strip route groups like (docs) */
  rel = rel
    .split("/")
    .filter((seg) => !(seg.startsWith("(") && seg.endsWith(")")))
    .join("/")
  /* index -> "" */
  rel = rel.replace(/(^|\/)index$/, "")
  return "/" + rel
}

const mdx = walk(ROUTES_DIR).map(toUrl)

/* dedupe + sort, add static entries */
export const ROUTES: readonly string[] = Array.from(
  new Set<string>(["/", "/solid", ...mdx]),
).sort()
