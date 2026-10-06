/*
 * Raw-Solid floors for the disclosure parts (plan 8 step 3.2): the DOM the Base UI parts render,
 * hand-written with plain Solid JSX and signals and nothing else. The gap between a part and its
 * floor is the part's machinery.
 */
import { createSignal, For, Show } from 'solid-js';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const setExposed = (key: string) => (value: unknown) => setters[key](value);
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function RawCollapsible(props: { index: number; open: () => boolean; toggle: () => void }) {
  const panelId = `raw-panel-${props.index}`;
  return (
    <div data-open={props.open() ? '' : undefined} data-closed={props.open() ? undefined : ''}>
      <button
        type="button"
        tabindex="0"
        aria-disabled="false"
        aria-expanded={props.open() ? 'true' : 'false'}
        aria-controls={props.open() ? panelId : undefined}
        data-panel-open={props.open() ? '' : undefined}
        onClick={props.toggle}
      >
        Trigger {props.index}
      </button>
      <Show when={props.open()}>
        <div id={panelId} data-open="">
          Panel {props.index}
        </div>
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
      {range(size(300)).map((i) => (
        <RawCollapsible index={i} open={open} toggle={() => {}} />
      ))}
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
      {range(size(300)).map((i) => {
        const [open, setOpen] = createSignal(false);
        return <RawCollapsible index={i} open={open} toggle={() => setOpen((o) => !o)} />;
      })}
    </div>
  );
}

const accItems = items(size(300));
function RawAccordion() {
  const value = useExposed('value', [] as string[]);
  return (
    <div>
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
                <div id={panelId} role="region" aria-labelledby={triggerId} data-open="">
                  Content {it.label}
                </div>
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
