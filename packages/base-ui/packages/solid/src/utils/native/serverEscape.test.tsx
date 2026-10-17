/*
 * A native part's server markup escapes its text children as compiled JSX does: a consumer's
 * text that contains markup characters must not become markup in the server's HTML.
 */
import { screen } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures from './serverEscape.ssr-fixtures';

const PARTS = [
  'collapsible-root',
  'collapsible-trigger',
  'collapsible-panel',
  'accordion-item',
  'accordion-trigger',
  'accordion-panel',
  'tabs-tab',
  'tabs-panel',
  'slow-trigger',
  'plain',
];

describe('server-rendered text children', () => {
  it.each(PARTS)('escapes markup characters (%s)', (part) => {
    const { html } = renderServer(fixtures, 'textChildren');
    expect(html).not.toContain(`<b>${part}</b>`);
    expect(html).toContain(`&lt;b>${part}&lt;/b>`);
  });

  it('writes literal JSX text once escaped: it reads as compiled JSX text does', () => {
    // The compiler hands a component its literal text decoded, and the part escapes it once;
    // compiled JSX writes the source text as it stands. Both read as the same text.
    renderServer(fixtures, 'literalText');
    expect(screen.getByTestId('literal-trigger')).toHaveTextContent('Tom & Jerry <3 & co');
    expect(screen.getByTestId('literal-plain')).toHaveTextContent('Tom & Jerry <3 & co');
  });
});
