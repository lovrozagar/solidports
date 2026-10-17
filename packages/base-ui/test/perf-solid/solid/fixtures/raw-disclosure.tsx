/*
 * Raw-Solid floors for the disclosure parts (plan 8 step 3.2): the DOM the Base UI parts render,
 * hand-written with plain Solid JSX and signals and nothing else. The gap between a part and its
 * floor is the part's machinery. Opening holds `data-starting-style` as the parts do
 * (`shared/raw-motion.ts`, D19); every raw list mounts closed, so a panel always mounts by opening.
 */
import { createSignal, For, onCleanup, Show } from 'solid-js';
import {
  afterNextFrame,
  openPanelPass,
  releaseAfterAnimations,
  sizeVar,
} from '../../shared/raw-motion';
import type { PanelSize } from '../../shared/raw-motion';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

/** An opening's `'starting'` and where it ends, for the panel to release its size there. */
interface Starting {
  starting: () => boolean;
  /** Runs `callback` after the write that ends `'starting'` (once). */
  whenEnds: (callback: () => void) => void;
}

/**
 * A panel that holds `starting` unless it has no motion, read once before paint; with motion it
 * keeps its measured size until its animations finish. Mounted by an open, as every raw list
 * starts closed. `vars` names its size variables (`--collapsible-panel`, `--accordion-panel`).
 */
function RawPanel(props: {
  opening: Starting;
  vars: string;
  id: string;
  labelledBy?: string;
  children: unknown;
}) {
  const [idle, setIdle] = createSignal(false);
  const [measured, setMeasured] = createSignal<PanelSize>();
  // eslint-disable-next-line solid/reactivity -- a panel's opening never changes: read once, as the parts read their fixed props
  const opening = props.opening;
  let panel: HTMLDivElement | undefined;
  queueMicrotask(() => {
    if (!panel?.isConnected) {
      return;
    }
    const element = panel;
    openPanelPass(
      element,
      () => setIdle(true),
      (sized) => {
        setMeasured(sized);
        opening.whenEnds(() =>
          queueMicrotask(() => releaseAfterAnimations(element, () => setMeasured(undefined))),
        );
      },
    );
  });
  return (
    <div
      ref={(el) => {
        panel = el;
      }}
      id={props.id}
      role={props.labelledBy ? 'region' : undefined}
      aria-labelledby={props.labelledBy}
      data-open=""
      data-starting-style={opening.starting() && !idle() ? '' : undefined}
      style={{
        [`${props.vars}-height`]: sizeVar(measured(), 'height'),
        [`${props.vars}-width`]: sizeVar(measured(), 'width'),
      }}
    >
      {props.children as never}
    </div>
  );
}

/** `'starting'` from an open of `open` until the task after the next frame. */
function createStarting(open: () => boolean): Starting {
  let wasOpen: boolean | undefined;
  let cancel: (() => void) | undefined;
  let ends: (() => void) | undefined;
  const [starting, setStarting] = createSignal((prev: boolean | undefined) => {
    const isOpen = open();
    if (isOpen === wasOpen) {
      return prev ?? false;
    }
    const mounting = wasOpen === undefined;
    wasOpen = isOpen;
    cancel?.();
    cancel = undefined;
    ends = undefined;
    if (!isOpen || mounting) {
      return false;
    }
    cancel = afterNextFrame(() => {
      cancel = undefined;
      setStarting(false);
      const ended = ends;
      ends = undefined;
      ended?.();
    });
    return true;
  });
  onCleanup(() => cancel?.());
  return {
    starting,
    whenEnds: (callback) => {
      ends = callback;
    },
  };
}

function RawCollapsible(props: { index: number; open: () => boolean; toggle: () => void }) {
  // eslint-disable-next-line solid/reactivity -- an instance's index never changes: read once, as the part reads its fixed props
  const panelId = `raw-panel-${props.index}`;
  // eslint-disable-next-line solid/reactivity -- `open` is an accessor the status tracks
  const opening = createStarting(props.open);
  return (
    <div
      data-open={props.open() ? '' : undefined}
      data-closed={props.open() ? undefined : ''}
      data-starting-style={opening.starting() ? '' : undefined}
    >
      <button
        type="button"
        tabindex="0"
        aria-disabled="false"
        aria-expanded={props.open() ? 'true' : 'false'}
        aria-controls={props.open() ? panelId : undefined}
        data-panel-open={props.open() ? '' : undefined}
        data-starting-style={opening.starting() ? '' : undefined}
        onClick={() => props.toggle()}
      >
        Trigger {props.index}
      </button>
      <Show when={props.open()}>
        <RawPanel id={panelId} opening={opening} vars="--collapsible-panel">
          Panel {props.index}
        </RawPanel>
      </Show>
    </div>
  );
}

// The list is static, so it is mapped once (idiomatic Solid for a fixed array; `<For>` is for
// arrays that change). `collapsible/raw-300-for` keeps the `<For>` form for comparison.
function RawCollapsibles() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => <RawCollapsible index={i} open={open} toggle={() => {}} />}
      </For>
    </div>
  );
}

function RawCollapsiblesFor() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => <RawCollapsible index={i} open={open} toggle={() => {}} />}
      </For>
    </div>
  );
}

function RawCollapsiblesUncontrolled() {
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => {
          const [open, setOpen] = createSignal(false);
          return <RawCollapsible index={i} open={open} toggle={() => setOpen((o) => !o)} />;
        }}
      </For>
    </div>
  );
}

/** An accordion panel holds its own `starting` from its open, the frame and the task after. */
function RawAccordionPanel(props: { id: string; labelledBy: string; children: unknown }) {
  const [starting, setStarting] = createSignal(true);
  let ends: (() => void) | undefined;
  onCleanup(
    afterNextFrame(() => {
      setStarting(false);
      ends?.();
    }),
  );
  const opening: Starting = {
    starting,
    whenEnds: (callback) => {
      ends = callback;
    },
  };
  return (
    <RawPanel
      id={props.id}
      labelledBy={props.labelledBy}
      opening={opening}
      vars="--accordion-panel"
    >
      {props.children}
    </RawPanel>
  );
}

const accItems = items(size(300));
function RawAccordion() {
  const value = useExposed('value', [] as string[]);
  return (
    <div>
      {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written page writes */}
      {accItems.map((it, i) => {
        const open = () => value().includes(it.value);
        const panelId = `raw-acc-panel-${i}`;
        const triggerId = `raw-acc-trigger-${i}`;
        return (
          <div
            data-index={i}
            data-open={open() ? '' : undefined}
            data-closed={open() ? undefined : ''}
            data-hidden={open() ? undefined : ''}
            data-orientation="vertical"
          >
            <h3
              data-index={i}
              data-open={open() ? '' : undefined}
              data-closed={open() ? undefined : ''}
              data-hidden={open() ? undefined : ''}
              data-orientation="vertical"
            >
              <button
                type="button"
                tabindex="0"
                id={triggerId}
                aria-disabled="false"
                aria-expanded={open() ? 'true' : 'false'}
                aria-controls={open() ? panelId : undefined}
                data-panel-open={open() ? '' : undefined}
                data-orientation="vertical"
                onClick={() => {}}
              >
                {it.label}
              </button>
            </h3>
            <Show when={open()}>
              <RawAccordionPanel id={panelId} labelledBy={triggerId}>
                Content {it.label}
              </RawAccordionPanel>
            </Show>
          </div>
        );
      })}
    </div>
  );
}

const tabItems = items(size(200));
function RawTabs() {
  const value = useExposed('value', tabItems[0].value);
  const [highlighted, setHighlighted] = createSignal(0);
  return (
    <div data-orientation="horizontal" data-activation-direction="none">
      <div role="tablist" data-orientation="horizontal" data-activation-direction="none">
        {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written page writes */}
        {tabItems.map((it, i) => {
          const active = () => it.value === value();
          return (
            <button
              type="button"
              role="tab"
              id={`raw-tab-${i}`}
              tabindex={highlighted() === i ? 0 : -1}
              aria-disabled="false"
              aria-selected={active() ? 'true' : 'false'}
              aria-controls={active() ? `raw-tabpanel-${i}` : undefined}
              data-active={active() ? '' : undefined}
              data-orientation="horizontal"
              data-activation-direction="none"
              onClick={() => setExposed('value')(it.value)}
              onFocus={() => setHighlighted(i)}
            >
              {it.label}
            </button>
          );
        })}
        <span role="presentation" />
      </div>
      {/* eslint-disable-next-line solid/prefer-for -- the floor's list never changes: a plain map is the minimum a hand-written page writes */}
      {tabItems.map((it, i) => (
        <Show when={it.value === value()}>
          <div
            role="tabpanel"
            id={`raw-tabpanel-${i}`}
            aria-labelledby={`raw-tab-${i}`}
            tabindex="0"
            data-index={i}
            data-orientation="horizontal"
            data-activation-direction="none"
          >
            Panel {it.label}
          </div>
        </Show>
      ))}
    </div>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'collapsible/raw-300': RawCollapsibles,
  'collapsible/raw-300-for': RawCollapsiblesFor,
  'collapsible/raw-300-uncontrolled': RawCollapsiblesUncontrolled,
  'accordion/raw-300': RawAccordion,
  'tabs/raw-200': RawTabs,
};
