// Collapsible and Accordion over the coverage matrix's remaining axes (plan 3, leaf 1.13): one
// instance with literal props, 1000 instances, a `{...props}` wrapper, a render function with
// state, the element form (a `{ component }` config, React's `render={<section />}`), and a
// consumer component that forwards its props and ref to a tag. Same markup as
// `react/fixtures/disclosure-coverage.tsx`.
import { For } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { items, size } from '../../shared/sizes';
import { setters, useExposed } from '../exposed';

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const setExposed = (key: string) => (value: unknown) => setters[key](value);

function CollapsibleOne() {
  return (
    <div>
      <Collapsible.Root>
        <Collapsible.Trigger>Trigger</Collapsible.Trigger>
        <Collapsible.Panel>Panel</Collapsible.Panel>
      </Collapsible.Root>
    </div>
  );
}

function Collapsibles1000() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(1000))}>
        {(i) => (
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
            <Collapsible.Panel>Panel {i}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

/** A consumer's wrapper that forwards every prop to the root. */
function WrappedRoot(props: Collapsible.Root.Props & { children: JSX.Element }) {
  return <Collapsible.Root {...props} />;
}

function CollapsiblesWrapped() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <WrappedRoot open={open()}>
            <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
            <Collapsible.Panel>Panel {i}</Collapsible.Panel>
          </WrappedRoot>
        )}
      </For>
    </div>
  );
}

function CollapsiblesRenderFn() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger
              render={(props, state) => (
                <button type="button" {...props}>
                  {state.open ? 'Close' : 'Open'} {i}
                </button>
              )}
            />
            <Collapsible.Panel render={(props) => <section {...props} />}>
              Panel {i}
            </Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

function CollapsiblesRenderElement() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger render={{ component: 'button', type: 'button' }}>
              Trigger {i}
            </Collapsible.Trigger>
            <Collapsible.Panel render={{ component: 'section' }}>Panel {i}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

/** A consumer's design-system button: forwards every prop, the ref included, to a tag. */
function AppButton(props: JSX.HTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} />;
}

/** A consumer's panel element, forwarding the same way. */
function AppSection(props: JSX.HTMLAttributes<HTMLElement>) {
  return <section {...props} />;
}

function CollapsiblesRenderComponent() {
  const open = useExposed('open', false);
  return (
    <div>
      <For each={range(size(300))}>
        {(i) => (
          <Collapsible.Root open={open()}>
            <Collapsible.Trigger render={{ component: AppButton }}>Trigger {i}</Collapsible.Trigger>
            <Collapsible.Panel render={{ component: AppSection }}>Panel {i}</Collapsible.Panel>
          </Collapsible.Root>
        )}
      </For>
    </div>
  );
}

function AccordionOne() {
  return (
    <Accordion.Root>
      <Accordion.Item value="one">
        <Accordion.Header>
          <Accordion.Trigger>Trigger</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>Panel</Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  );
}

function controlledAccordion(
  count: number,
  item: (it: { value: string; label: string }) => JSX.Element,
) {
  return function ControlledAccordion() {
    const value = useExposed('value', [] as string[]);
    const list = items(size(count));
    return (
      <Accordion.Root multiple value={value()} onValueChange={setExposed('value')}>
        <For each={list}>{item}</For>
      </Accordion.Root>
    );
  };
}

const plainItem = (it: { value: string; label: string }) => (
  <Accordion.Item value={it.value}>
    <Accordion.Header>
      <Accordion.Trigger>{it.label}</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel>Content {it.label}</Accordion.Panel>
  </Accordion.Item>
);

/** A consumer's wrapper that forwards every prop to the item. */
function WrappedItem(props: Accordion.Item.Props & { children: JSX.Element }) {
  return <Accordion.Item {...props} />;
}

/** Every panel has a height transition: the motion branch of the panels' opening pass (D19). */
const MOTION_CSS = `
.motion-panel { height: var(--accordion-panel-height); overflow: hidden; transition: height 200ms ease-out; }
.motion-panel[data-starting-style], .motion-panel[data-ending-style] { height: 0; }
`;

const MotionAccordion = controlledAccordion(300, (it) => (
  <Accordion.Item value={it.value}>
    <Accordion.Header>
      <Accordion.Trigger>{it.label}</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel class="motion-panel">Content {it.label}</Accordion.Panel>
  </Accordion.Item>
));

function AccordionMotion() {
  return (
    <>
      <style>{MOTION_CSS}</style>
      <MotionAccordion />
    </>
  );
}

export const fixtures: Record<string, () => unknown> = {
  'collapsible/1': CollapsibleOne,
  'collapsible/1000': Collapsibles1000,
  'collapsible/wrapper-300': CollapsiblesWrapped,
  'collapsible/render-fn-300': CollapsiblesRenderFn,
  'collapsible/render-element-300': CollapsiblesRenderElement,
  'collapsible/render-component-300': CollapsiblesRenderComponent,
  'accordion/1': AccordionOne,
  'accordion/1000': controlledAccordion(1000, plainItem),
  'accordion/motion-300': AccordionMotion,
  'accordion/wrapper-300': controlledAccordion(300, (it) => (
    <WrappedItem value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger>{it.label}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Content {it.label}</Accordion.Panel>
    </WrappedItem>
  )),
  'accordion/render-fn-300': controlledAccordion(300, (it) => (
    <Accordion.Item value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger
          render={(props, state) => (
            <button type="button" {...props}>
              {state.open ? 'Close' : 'Open'} {it.label}
            </button>
          )}
        />
      </Accordion.Header>
      <Accordion.Panel render={(props) => <section {...props} />}>
        Content {it.label}
      </Accordion.Panel>
    </Accordion.Item>
  )),
  'accordion/render-element-300': controlledAccordion(300, (it) => (
    <Accordion.Item value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger render={{ component: 'button', type: 'button' }}>
          {it.label}
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel render={{ component: 'section' }}>Content {it.label}</Accordion.Panel>
    </Accordion.Item>
  )),
  'accordion/render-component-300': controlledAccordion(300, (it) => (
    <Accordion.Item value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger render={{ component: AppButton }}>{it.label}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel render={{ component: AppSection }}>Content {it.label}</Accordion.Panel>
    </Accordion.Item>
  )),
};
