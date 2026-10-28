/*
 * Raw-React floors for the disclosure parts (plan 8 step 3.2): the DOM the Base UI parts render,
 * hand-written with plain React elements and state. The Solid twin is `solid/fixtures/raw-disclosure.tsx`.
 * Opening holds `data-starting-style` as the parts do (`shared/raw-motion.ts`, D19); every raw
 * list mounts closed, so a panel always mounts by opening.
 */
import * as React from 'react';
import {
  afterNextFrame,
  openPanelPass,
  releaseAfterAnimations,
  sizeVar,
} from '../../shared/raw-motion';
import type { PanelSize } from '../../shared/raw-motion';
import { size, itemList } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const noop = () => {};

/**
 * A panel that holds `starting` unless it has no motion, read once before paint; with motion it
 * keeps its measured size until its animations finish after `starting` ends. Mounted by an open, as
 * every raw list starts closed. `vars` names its size variables.
 */
function RawPanel({
  starting,
  vars,
  id,
  labelledBy,
  children,
}: {
  starting: boolean;
  vars: string;
  id: string;
  labelledBy?: string;
  children: React.ReactNode;
}) {
  const [idle, setIdle] = React.useState(false);
  const [measured, setMeasured] = React.useState<PanelSize>();
  const ref = React.useRef<HTMLDivElement>(null);
  React.useLayoutEffect(() => {
    openPanelPass(ref.current!, () => setIdle(true), setMeasured);
  }, []);
  // After the commit that removed `starting`, so the transition it starts is among the animations.
  React.useEffect(() => {
    if (starting || !measured) {
      return;
    }
    releaseAfterAnimations(ref.current!, () => setMeasured(undefined));
  }, [starting, measured]);
  return (
    <div
      ref={ref}
      id={id}
      role={labelledBy ? 'region' : undefined}
      aria-labelledby={labelledBy}
      data-open=""
      data-starting-style={starting && !idle ? '' : undefined}
      style={
        {
          [`${vars}-height`]: sizeVar(measured, 'height'),
          [`${vars}-width`]: sizeVar(measured, 'width'),
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  );
}

/** `true` from an open of `open` until the task after the next frame. */
function useStarting(open: boolean) {
  const [wasOpen, setWasOpen] = React.useState(open);
  const [starting, setStarting] = React.useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    setStarting(open);
  }
  React.useEffect(() => {
    if (!starting) {
      return undefined;
    }
    return afterNextFrame(() => setStarting(false));
  }, [starting]);
  return starting;
}

function RawCollapsible({
  index,
  open,
  toggle,
}: {
  index: number;
  open: boolean;
  toggle: () => void;
}) {
  const panelId = `raw-panel-${index}`;
  const starting = useStarting(open);
  return (
    <div
      data-open={open ? '' : undefined}
      data-closed={open ? undefined : ''}
      data-starting-style={starting ? '' : undefined}
    >
      <button
        type="button"
        tabIndex={0}
        aria-disabled="false"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? panelId : undefined}
        data-panel-open={open ? '' : undefined}
        data-starting-style={starting ? '' : undefined}
        onClick={toggle}
      >
        Trigger {index}
      </button>
      {open ? (
        <RawPanel id={panelId} starting={starting} vars="--collapsible-panel">
          Panel {index}
        </RawPanel>
      ) : null}
    </div>
  );
}

function RawCollapsibles() {
  const open = useExposed('open', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <RawCollapsible key={i} index={i} open={open} toggle={noop} />
      ))}
    </div>
  );
}

function RawCollapsibleUncontrolled({ index }: { index: number }) {
  const [open, setOpen] = React.useState(false);
  return <RawCollapsible index={index} open={open} toggle={() => setOpen((o) => !o)} />;
}

function RawCollapsiblesUncontrolled() {
  return (
    <div>
      {range(size(300)).map((i) => (
        <RawCollapsibleUncontrolled key={i} index={i} />
      ))}
    </div>
  );
}

/** An accordion panel holds its own `starting` from its open, the frame and the task after. */
function RawAccordionPanel({
  id,
  labelledBy,
  children,
}: {
  id: string;
  labelledBy: string;
  children: React.ReactNode;
}) {
  const [starting, setStarting] = React.useState(true);
  React.useEffect(() => afterNextFrame(() => setStarting(false)), []);
  return (
    <RawPanel id={id} labelledBy={labelledBy} starting={starting} vars="--accordion-panel">
      {children}
    </RawPanel>
  );
}

const accItems = itemList(300);
function RawAccordion() {
  const value = useExposed('value', [] as string[]);
  return (
    <div>
      {accItems().map((it, i) => {
        const open = value.includes(it.value);
        const panelId = `raw-acc-panel-${i}`;
        const triggerId = `raw-acc-trigger-${i}`;
        return (
          <div
            key={it.value}
            data-index={i}
            data-open={open ? '' : undefined}
            data-closed={open ? undefined : ''}
            data-hidden={open ? undefined : ''}
            data-orientation="vertical"
          >
            <h3
              data-index={i}
              data-open={open ? '' : undefined}
              data-closed={open ? undefined : ''}
              data-hidden={open ? undefined : ''}
              data-orientation="vertical"
            >
              <button
                type="button"
                tabIndex={0}
                id={triggerId}
                aria-disabled="false"
                aria-expanded={open ? 'true' : 'false'}
                aria-controls={open ? panelId : undefined}
                data-panel-open={open ? '' : undefined}
                data-orientation="vertical"
                onClick={noop}
              >
                {it.label}
              </button>
            </h3>
            {open ? (
              <RawAccordionPanel id={panelId} labelledBy={triggerId}>
                Content {it.label}
              </RawAccordionPanel>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const tabItems = itemList(200);
function RawTabs() {
  const value = useExposed('value', tabItems()[0].value);
  const [highlighted, setHighlighted] = React.useState(0);
  return (
    <div data-orientation="horizontal" data-activation-direction="none">
      <div role="tablist" data-orientation="horizontal" data-activation-direction="none">
        {tabItems().map((it, i) => {
          const active = it.value === value;
          return (
            <button
              key={it.value}
              type="button"
              role="tab"
              id={`raw-tab-${i}`}
              tabIndex={highlighted === i ? 0 : -1}
              aria-disabled="false"
              aria-selected={active ? 'true' : 'false'}
              aria-controls={active ? `raw-tabpanel-${i}` : undefined}
              data-active={active ? '' : undefined}
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
      {tabItems().map((it, i) =>
        it.value === value ? (
          <div
            key={it.value}
            role="tabpanel"
            id={`raw-tabpanel-${i}`}
            aria-labelledby={`raw-tab-${i}`}
            tabIndex={0}
            data-index={i}
            data-orientation="horizontal"
            data-activation-direction="none"
          >
            Panel {it.label}
          </div>
        ) : null,
      )}
    </div>
  );
}

export const fixtures: Record<string, React.FC> = {
  'collapsible/raw-300': RawCollapsibles,
  'collapsible/raw-300-for': RawCollapsibles,
  'collapsible/raw-300-uncontrolled': RawCollapsiblesUncontrolled,
  'accordion/raw-300': RawAccordion,
  'tabs/raw-200': RawTabs,
};
