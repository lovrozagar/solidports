/*
 * A native panel's server state (D9): the server renders a panel's attributes without the panel's
 * measurement and transition machinery, which only runs on the client. Each panel's server
 * attributes must equal what the client renders for the same fixture once it has flushed. A
 * generated id differs between a server and a client render, so ids compare by presence.
 */
import { flush } from 'solid-js';
import { describe, expect, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import type { SsrFixtures } from '../../../test/ssrFixtures';
import accordionFixtures from '../../accordion/panel/AccordionPanel.ssr-fixtures';
import collapsibleFixtures from './CollapsiblePanel.ssr-fixtures';

const GENERATED = new Set(['id', 'aria-labelledby', 'aria-controls']);

/** An element's attributes, with style declarations sorted and generated ids as presence. */
function attributesOf(element: Element) {
  const attributes: Record<string, string> = {};
  for (const { name, value } of element.attributes) {
    if (name === '_hk') {
      continue;
    }
    if (name === 'style') {
      attributes[name] = value
        .split(';')
        .map((declaration) => declaration.trim().replace(/\s*:\s*/, ':'))
        .filter(Boolean)
        .sort()
        .join(';');
    } else {
      attributes[name] = GENERATED.has(name) ? '(generated)' : value;
    }
  }
  return attributes;
}

const PANELS = ['open', 'keepMountedClosed', 'hiddenUntilFoundClosed'] as const;

describe.each([
  ['Collapsible', collapsibleFixtures],
  ['Accordion', accordionFixtures],
] as [string, SsrFixtures<(typeof PANELS)[number]>][])('%s.Panel server state', (_, fixtures) => {
  const { render } = createRenderer();

  it.each(PANELS)('renders the client attributes on the server (%s)', (name) => {
    renderServer(fixtures, name);
    const serverAttributes = attributesOf(screen.getByTestId('panel'));

    render(fixtures.fixtures[name]);
    flush();
    // The server container comes first in the document, the client render after it.
    const [, clientPanel] = screen.getAllByTestId('panel');
    expect(serverAttributes).toEqual(attributesOf(clientPanel));
  });
});
