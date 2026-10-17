/*
 * Parts mounted after a hydration (client navigation in a server-rendered app) render their
 * children: `provideContext` must resolve the provider's children after Solid's hydration runtime
 * is enabled, as before it.
 */
import { describe, expect, it } from 'vitest';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { flush } from 'solid-js';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer, expectNativePath } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import accordionFixtures from '../../accordion/root/AccordionRoot.ssr-fixtures';
import fixtures from './CollapsibleRoot.ssr-fixtures';
import panelFixtures from '../panel/CollapsiblePanel.ssr-fixtures';

describe('<Collapsible.Root /> after hydration', () => {
  const { render } = createRenderer();

  it('renders its children when mounted after a server-rendered tree hydrated', async () => {
    const { hydrate } = renderServer(accordionFixtures, 'defaultOpen');
    hydrate();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Trigger 1' })).toHaveAttribute('aria-expanded');
    });

    render(() => (
      <Collapsible.Root>
        <Collapsible.Trigger>Client trigger</Collapsible.Trigger>
      </Collapsible.Root>
    ));

    expect(screen.getByRole('button', { name: 'Client trigger' })).toBeInTheDocument();
  });
});

describe('<Collapsible.Root /> hydration', () => {
  it('renders the client state when it changes while hydrating', async () => {
    const { hydrate } = renderServer(fixtures, 'openedDuringHydration');
    const root = screen.getByTestId('root');
    expect(root).toHaveAttribute('data-closed');
    hydrate();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
    expect(root).toHaveAttribute('data-open');
    expect(root).not.toHaveAttribute('data-closed');
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-panel-open');
  });
});

describe('native parts after hydration', () => {
  // The first write after hydration diffs against what the element was last written with: the
  // consumer's literal attributes, written once, must not read as removed.
  it('keeps the consumer literal attributes when the state changes', async () => {
    const { hydrate } = renderServer(panelFixtures, 'open');
    hydrate();
    await new Promise<void>((done) => {
      queueMicrotask(done);
    });
    const trigger = screen.getByTestId('trigger');
    fireEvent.click(trigger);
    flush();
    expect(trigger).toHaveAttribute('data-testid', 'trigger');
    expect(screen.getByTestId('root')).toHaveAttribute('data-closed');
    fireEvent.click(trigger);
    flush();
    expect(trigger).toHaveAttribute('data-testid', 'trigger');
    expect(screen.getByTestId('panel')).toHaveAttribute('data-open');
  });
});

describe('render forms after hydration (plan 3 leaf 5.1.2)', () => {
  // Each `render` value the port takes hydrates onto the server's elements: nothing is left
  // unclaimed, and the elements the server wrote are the ones the state updates reach.
  for (const name of [
    'renderTag',
    'renderConfig',
    'renderComponent',
    'renderComponentNoRef',
    'renderFunction',
  ] as const) {
    it(`claims the server elements of ${name} and updates them`, async () => {
      const { hydrate, unclaimedNodes } = renderServer(fixtures, name);
      const trigger = screen.getByTestId('trigger');
      const panel = screen.getByTestId('panel');
      hydrate();
      await new Promise<void>((done) => {
        queueMicrotask(done);
      });
      expect(unclaimedNodes()).toEqual([]);
      // The native path rendered both (a fallback would claim the same nodes on the slow path). Its
      // development mark is set through the ref, which a component that drops it never calls; the
      // cost tests pin that form's path.
      if (name !== 'renderComponentNoRef') {
        expectNativePath(trigger, panel);
      }
      fireEvent.click(trigger);
      flush();
      expect(screen.getByTestId('trigger')).toBe(trigger);
      expect(screen.getByTestId('panel')).toBe(panel);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(panel).toHaveAttribute('data-closed');
      fireEvent.click(trigger);
      flush();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(panel).toHaveAttribute('data-open');
    });
  }
});
