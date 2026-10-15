/*
 * An API table renders the same markup on the server and the client, hydrates every element the
 * server rendered, and its type references stay interactive.
 */
import { fireEvent, waitFor } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import {
  hydrateEntry,
  normalizeMarkup,
  renderClient,
  serverHtml,
} from '../__fixtures__/hydration';
import { BareTypesFixture, TypesFixture } from './useTypes.fixture';

const ENTRY = 'useTypes/useTypes.server.tsx';

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

describe('useTypes', () => {
  it('renders the API table on the server as on the client', () => {
    const client = renderClient(() => <BareTypesFixture />);
    cleanup = client.dispose;
    expect(client.container.querySelector('.ReferenceAccordionRoot')).not.toBeNull();
    expect(normalizeMarkup(serverHtml('useTypes/useTypes.bare.server.tsx'))).toEqual(
      normalizeMarkup(client.container.innerHTML),
    );
  });

  it('hydrates every server-rendered element', async () => {
    const hydrated = await hydrateEntry(ENTRY, () => <TypesFixture />);
    cleanup = hydrated.dispose;
    expect(hydrated.warnings).toEqual([]);
    expect(hydrated.unclaimed.map((element) => element.outerHTML.slice(0, 80))).toEqual([]);
  });

  it('opens a type reference after hydration', async () => {
    const hydrated = await hydrateEntry(ENTRY, () => <TypesFixture />);
    cleanup = hydrated.dispose;
    const trigger = hydrated.container.querySelector('.TypeRefTrigger');
    expect(trigger).not.toBeNull();
    fireEvent.click(trigger!);
    await waitFor(() => {
      expect(document.querySelector('.TypeRefPopup')).not.toBeNull();
    });
  });
});
