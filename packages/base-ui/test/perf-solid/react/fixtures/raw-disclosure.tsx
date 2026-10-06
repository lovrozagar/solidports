/*
 * Raw-React floors for the disclosure parts (plan 8 step 3.2): the DOM the Base UI parts render,
 * hand-written with plain React elements and state. The Solid twin is `solid/fixtures/raw-disclosure.tsx`.
 */
import * as React from 'react';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const noop = () => {};

function RawCollapsible({ index, open, toggle }: { index: number; open: boolean; toggle: () => void }) {
  const panelId = `raw-panel-${index}`;
  return (
    <div data-open={open ? '' : undefined} data-closed={open ? undefined : ''}>
      <button
        type="button"
        tabIndex={0}
        aria-disabled="false"
        aria-expanded={open ? 'true' : 'false'}
        aria-controls={open ? panelId : undefined}
        data-panel-open={open ? '' : undefined}
        onClick={toggle}
      >
        Trigger {index}
      </button>
      {open ? (
        <div id={panelId} data-open="">
          Panel {index}
        </div>
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

const accItems = items(size(300));
function RawAccordion() {
  const value = useExposed('value', [] as string[]);
  return (
    <div>
      {accItems.map((it, i) => {
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
              <div id={panelId} role="region" aria-labelledby={triggerId} data-open="">
                Content {it.label}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

const tabItems = items(size(200));
function RawTabs() {
  const value = useExposed('value', tabItems[0].value);
  const [highlighted, setHighlighted] = React.useState(0);
  return (
    <div data-orientation="horizontal" data-activation-direction="none">
      <div role="tablist" data-orientation="horizontal" data-activation-direction="none">
        {tabItems.map((it, i) => {
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
      {tabItems.map((it, i) =>
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
