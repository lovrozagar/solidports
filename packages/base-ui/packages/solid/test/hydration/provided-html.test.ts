/*
 * The server HTML the global setup provides to the hydration tests (`globalSetup.ts`). Browser mode
 * inlines provided values into the orchestrator page's `<script>`, so a fixture whose HTML holds
 * `</script>` (a prehydration script) ended that script early: the page had no browser state and
 * every browser test file failed to connect ("getBrowserState() is undefined"). The HTML is
 * provided URI-encoded, as the SSR fixtures are, and read back through `serverHtml()`.
 */
import { describe, expect, inject, it } from 'vitest';
import { serverHtml } from './serverHtml';

describe('provided server HTML', () => {
  const provided = inject('serverHtml');

  it('is provided URI-encoded, so no value can end the page script it is inlined into', () => {
    expect(Object.keys(provided).length).toBeGreaterThan(0);
    expect(Object.keys(provided).filter((file) => /[<>]/.test(provided[file]))).toEqual([]);
  });

  it('reads back as the markup, a prehydration script included', () => {
    const html = serverHtml('slider.server.tsx');
    expect(html).toContain('<script');
    expect(html).toContain('</script>');
  });
});
