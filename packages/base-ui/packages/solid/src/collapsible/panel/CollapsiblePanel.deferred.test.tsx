/*
 * An initially open native panel builds its client machinery on its first change (D11). Closing it
 * right after hydration, flipping a controlled `open`, or finding a hidden-until-found panel must
 * run frame by frame as it does for a panel created open with its machinery built: the slow path's
 * panel (a `render` prop), which never defers.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import { afterEach, describe, expect, it } from 'vitest';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer, expectNativePath, expectSlowPath } from '#test-utils';
import { renderServer } from '../../../test/ssrFixtures';
import fixtures, {
  TRANSITION_STYLE,
  setControlledOpen,
} from './CollapsiblePanel.deferred.ssr-fixtures';

const nextFrame = () =>
  new Promise<void>((done) => {
    requestAnimationFrame(() => setTimeout(done));
  });

/** The panel's attributes (generated ids left out, names and style declarations sorted), or `removed`. */
function snapshot(panel: Element | undefined) {
  if (!panel?.isConnected) {
    return 'removed';
  }
  const attributes: [string, string][] = [];
  for (const { name, value } of panel.attributes) {
    if (name === 'id' || name === '_hk') {
      continue;
    }
    attributes.push([
      name,
      name === 'style'
        ? value
            .split(';')
            .map((declaration) => declaration.replace(/\s*:\s*/, ':').trim())
            .filter(Boolean)
            .sort()
            .join(';')
        : value,
    ]);
  }
  return JSON.stringify(attributes.sort(([a], [b]) => (a < b ? -1 : 1)));
}

/** The panel's distinct states: before `act`, then frame by frame until four frames pass unchanged. */
async function settle(panel: () => Element | undefined, act: () => void = () => {}) {
  const states = [snapshot(panel())];
  act();
  flush();
  let unchanged = 0;
  for (let frame = 0; frame < 60 && unchanged < 4; frame += 1) {
    const state = snapshot(panel());
    if (state === states.at(-1)) {
      unchanged += 1;
    } else {
      unchanged = 0;
      states.push(state);
    }
    // eslint-disable-next-line no-await-in-loop -- frames run one after another
    await nextFrame();
    flush();
  }
  return states;
}

const last = (testId: string) => () => screen.queryAllByTestId(testId).at(-1);
const clickTrigger = () => fireEvent.click(last('trigger')()!);
const findPanel = () => fireEvent(last('panel')()!, new Event('beforematch'));

/**
 * Spread props: the compiler hands the part a merged proxy, which keeps every part on the slow path
 * (a reactive `render` renders natively in the disclosure parts since plan 3 leaf 5.1.2b, and a
 * JSX `ref` always compiles to a static function). Empty: it adds no prop.
 */
const SLOW_PATH: Record<string, never> = {};

/** The fixture's panel created open on the client on the slow path. */
function CreatedOpen(props: { keepMounted?: boolean; hiddenUntilFound?: boolean; open?: boolean }) {
  return (
    <>
      <style>{TRANSITION_STYLE}</style>
      <Collapsible.Root defaultOpen open={props.open} onOpenChange={setControlledOpen}>
        <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
        <Collapsible.Panel
          class="deferred-panel"
          data-testid="panel"
          keepMounted={props.keepMounted}
          hiddenUntilFound={props.hiddenUntilFound}
          {...SLOW_PATH}
        >
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    </>
  );
}

describe('a panel open since the server rendered it', () => {
  const { render } = createRenderer();
  afterEach(() => {
    setControlledOpen(true);
  });

  async function hydrated(
    name: 'openKeepMounted' | 'openUnmounts' | 'openHiddenUntilFound' | 'openControlled',
  ) {
    const { hydrate } = renderServer(fixtures, name);
    const view = hydrate();
    await settle(last('panel'));
    expectNativePath(last('panel')()!);
    return view;
  }

  async function createdOpen(props: Parameters<typeof CreatedOpen>[0]) {
    render(() => <CreatedOpen {...props} />);
    await settle(last('panel'));
    expectSlowPath(last('panel')()!);
  }

  it.each([
    ['openKeepMounted', { keepMounted: true }],
    ['openUnmounts', {}],
  ] as const)(
    'closes right after hydration as a panel created open does (%s)',
    async (name, props) => {
      const server = await hydrated(name);
      const afterHydration = await settle(last('panel'), clickTrigger);
      server.dispose();

      await createdOpen(props);
      const onTheClient = await settle(last('panel'), clickTrigger);
      expect(afterHydration).toEqual(onTheClient);
      expect(afterHydration.length).toBeGreaterThan(1);
    },
  );

  it('opens again after closing right after hydration as a panel created open does', async () => {
    const server = await hydrated('openKeepMounted');
    await settle(last('panel'), clickTrigger);
    const afterHydration = await settle(last('panel'), clickTrigger);
    server.dispose();

    await createdOpen({ keepMounted: true });
    await settle(last('panel'), clickTrigger);
    const onTheClient = await settle(last('panel'), clickTrigger);
    expect(afterHydration).toEqual(onTheClient);
    expect(afterHydration.length).toBeGreaterThan(1);
  });

  it('is found after closing right after hydration as a panel created open is', async () => {
    const server = await hydrated('openHiddenUntilFound');
    await settle(last('panel'), clickTrigger);
    const afterHydration = await settle(last('panel'), findPanel);
    server.dispose();

    await createdOpen({ hiddenUntilFound: true });
    await settle(last('panel'), clickTrigger);
    const onTheClient = await settle(last('panel'), findPanel);
    expect(afterHydration).toEqual(onTheClient);
    expect(afterHydration.length).toBeGreaterThan(1);
  });

  it('closes on a controlled open flipped right after hydration as a panel created open does', async () => {
    const server = await hydrated('openControlled');
    const afterHydration = await settle(last('panel'), () => setControlledOpen(false));
    server.dispose();

    setControlledOpen(true);
    const [open, setOpen] = createSignal(true);
    render(() => <CreatedOpen keepMounted open={open()} />);
    await settle(last('panel'));
    const onTheClient = await settle(last('panel'), () => setOpen(false));
    expect(afterHydration).toEqual(onTheClient);
    expect(afterHydration.length).toBeGreaterThan(1);
  });

  it('closes when the state changes while hydrating', async () => {
    const { hydrate } = renderServer(fixtures, 'closedDuringHydration');
    const server = hydrate();
    await settle(last('panel'));
    expectNativePath(screen.getByTestId('panel'));
    expect(screen.getByTestId('root')).toHaveAttribute('data-closed');
    expect(screen.getByTestId('panel')).toHaveAttribute('hidden');
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
    const siblingPanel = screen.getByTestId('sibling-panel');
    expect(siblingPanel.id).not.toBe('');
    expect(screen.getByTestId('sibling-trigger')).toHaveAttribute('aria-controls', siblingPanel.id);
    // The machinery built after hydration has the element: reopening runs frame by frame as for a
    // panel created open and closed once.
    const afterHydration = await settle(last('panel'), clickTrigger);
    expect(screen.getByTestId('panel')).toHaveAttribute('data-open');
    expect(screen.getByTestId('panel')).not.toHaveAttribute('hidden');
    server.dispose();

    await createdOpen({ keepMounted: true });
    await settle(last('panel'), clickTrigger);
    const onTheClient = await settle(last('panel'), clickTrigger);
    expect(afterHydration).toEqual(onTheClient);
    expect(afterHydration.length).toBeGreaterThan(1);
  });
});
