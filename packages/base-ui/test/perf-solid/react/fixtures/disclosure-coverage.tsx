// Collapsible and Accordion over the coverage matrix's remaining axes (plan 3, leaf 1.13): one
// instance with literal props, 1000 instances, a `{...props}` wrapper, a render function with
// state, a render element, and a consumer component that forwards its props and ref to a tag.
// Same markup as `solid/fixtures/disclosure-coverage.tsx`.
import * as React from 'react';
import { Accordion } from '@base-ui/react/accordion';
import { Collapsible } from '@base-ui/react/collapsible';
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
      {range(size(1000)).map((i) => (
        <Collapsible.Root key={i} open={open}>
          <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  );
}

/** A consumer's wrapper that forwards every prop to the root. */
function WrappedRoot(props: Collapsible.Root.Props) {
  return <Collapsible.Root {...props} />;
}

function CollapsiblesWrapped() {
  const open = useExposed('open', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <WrappedRoot key={i} open={open}>
          <Collapsible.Trigger>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel>Panel {i}</Collapsible.Panel>
        </WrappedRoot>
      ))}
    </div>
  );
}

function CollapsiblesRenderFn() {
  const open = useExposed('open', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <Collapsible.Root key={i} open={open}>
          <Collapsible.Trigger
            render={(props, state) => (
              <button type="button" {...props}>
                {state.open ? 'Close' : 'Open'} {i}
              </button>
            )}
          />
          <Collapsible.Panel render={(props) => <section {...props} />}>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  );
}

function CollapsiblesRenderElement() {
  const open = useExposed('open', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <Collapsible.Root key={i} open={open}>
          <Collapsible.Trigger render={<button type="button" />}>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel render={<section />}>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
    </div>
  );
}

/** A consumer's design-system button: forwards every prop, the ref included (React 19), to a tag. */
function AppButton(props: React.ComponentProps<'button'>) {
  return <button type="button" {...props} />;
}

/** A consumer's panel element, forwarding the same way. */
function AppSection(props: React.ComponentProps<'section'>) {
  return <section {...props} />;
}

function CollapsiblesRenderComponent() {
  const open = useExposed('open', false);
  return (
    <div>
      {range(size(300)).map((i) => (
        <Collapsible.Root key={i} open={open}>
          <Collapsible.Trigger render={<AppButton />}>Trigger {i}</Collapsible.Trigger>
          <Collapsible.Panel render={<AppSection />}>Panel {i}</Collapsible.Panel>
        </Collapsible.Root>
      ))}
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
  item: (it: { value: string; label: string }) => React.ReactNode,
) {
  return function ControlledAccordion() {
    const value = useExposed('value', [] as string[]);
    const list = items(size(count));
    return (
      <Accordion.Root multiple value={value} onValueChange={setExposed('value')}>
        {list.map(item)}
      </Accordion.Root>
    );
  };
}

const plainItem = (it: { value: string; label: string }) => (
  <Accordion.Item key={it.value} value={it.value}>
    <Accordion.Header>
      <Accordion.Trigger>{it.label}</Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel>Content {it.label}</Accordion.Panel>
  </Accordion.Item>
);

/** A consumer's wrapper that forwards every prop to the item. */
function WrappedItem(props: Accordion.Item.Props) {
  return <Accordion.Item {...props} />;
}

export const fixtures: Record<string, React.FC> = {
  'collapsible/1': CollapsibleOne,
  'collapsible/1000': Collapsibles1000,
  'collapsible/wrapper-300': CollapsiblesWrapped,
  'collapsible/render-fn-300': CollapsiblesRenderFn,
  'collapsible/render-element-300': CollapsiblesRenderElement,
  'collapsible/render-component-300': CollapsiblesRenderComponent,
  'accordion/1': AccordionOne,
  'accordion/1000': controlledAccordion(1000, plainItem),
  'accordion/wrapper-300': controlledAccordion(300, (it) => (
    <WrappedItem key={it.value} value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger>{it.label}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel>Content {it.label}</Accordion.Panel>
    </WrappedItem>
  )),
  'accordion/render-fn-300': controlledAccordion(300, (it) => (
    <Accordion.Item key={it.value} value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger
          render={(props, state) => (
            <button type="button" {...props}>
              {state.open ? 'Close' : 'Open'} {it.label}
            </button>
          )}
        />
      </Accordion.Header>
      <Accordion.Panel render={(props) => <section {...props} />}>Content {it.label}</Accordion.Panel>
    </Accordion.Item>
  )),
  'accordion/render-element-300': controlledAccordion(300, (it) => (
    <Accordion.Item key={it.value} value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger render={<button type="button" />}>{it.label}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel render={<section />}>Content {it.label}</Accordion.Panel>
    </Accordion.Item>
  )),
  'accordion/render-component-300': controlledAccordion(300, (it) => (
    <Accordion.Item key={it.value} value={it.value}>
      <Accordion.Header>
        <Accordion.Trigger render={<AppButton />}>{it.label}</Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel render={<AppSection />}>Content {it.label}</Accordion.Panel>
    </Accordion.Item>
  )),
};
