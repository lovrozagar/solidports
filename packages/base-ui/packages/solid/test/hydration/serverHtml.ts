import { inject } from 'vitest';

/**
 * The server HTML of a `test/hydration/*.server.tsx` entry. The global setup provides it
 * URI-encoded (`globalSetup.ts`): browser mode inlines provided values into a page `<script>`,
 * which a fixture's own `</script>` would end.
 */
export function serverHtml(file: string): string {
  const encoded = inject('serverHtml')[file];
  if (encoded === undefined) {
    throw new Error(`globalSetup did not server-render ${file}`);
  }
  return decodeURIComponent(encoded);
}
