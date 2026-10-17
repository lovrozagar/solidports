/*
 * A `render` a consumer's wrapper forwards (`render={props.render}`, a getter) renders natively in
 * the disclosure Trigger and Panel (plan 3 leaf 5.1.2b) under one branch memo: when the forwarded
 * value changes between a function and a tag, the element swaps and keeps the part's attributes,
 * as the slow path's branch does.
 */
import { createSignal, flush } from 'solid-js';
import { screen, waitFor } from '@solidjs/testing-library';
import { describe, expect, it } from 'vitest';
import { Accordion } from '@solidports/base-ui/accordion';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { createRenderer, expectNativePath } from '#test-utils';

const renderSection = (props: object) => <section {...props} />;
const renderSpan = (props: object) => <span {...props} />;
type Forwarded = typeof renderSection | 'section' | undefined;

describe('a forwarded render', () => {
  const { render } = createRenderer();

  /** The parts' attributes, ids replaced, for comparing two elements of different tags. */
  const attributes = (el: Element) =>
    [...el.attributes]
      .filter((attr) => attr.name !== 'id' && attr.name !== 'aria-controls')
      .map((attr) => `${attr.name}=${attr.value}`)
      .sort()
      .join(' ');

  it('swaps the Collapsible elements between a function and a tag, natively', async () => {
    const [panelRender, setPanelRender] = createSignal<Forwarded>(() => renderSection);
    const [triggerRender, setTriggerRender] = createSignal<Forwarded | typeof renderSpan>(
      undefined,
    );
    function ForwardTrigger(props: { render?: Forwarded | typeof renderSpan }) {
      return (
        <Collapsible.Trigger data-testid="trigger" render={props.render as never}>
          Toggle
        </Collapsible.Trigger>
      );
    }
    function ForwardPanel(props: { render?: Forwarded }) {
      return (
        <Collapsible.Panel data-testid="panel" render={props.render}>
          Content
        </Collapsible.Panel>
      );
    }
    render(() => (
      <Collapsible.Root defaultOpen>
        <ForwardTrigger render={triggerRender()} />
        <ForwardPanel render={panelRender()} />
      </Collapsible.Root>
    ));
    const panel = () => screen.getByTestId('panel');
    const trigger = () => screen.getByTestId('trigger');
    expect(panel().tagName).toBe('SECTION');
    expect(trigger().tagName).toBe('BUTTON');
    expectNativePath(panel());
    expectNativePath(trigger());
    const sectionAttributes = attributes(panel());

    setPanelRender('section');
    flush();
    expect(panel().tagName).toBe('SECTION');
    expectNativePath(panel());
    expect(attributes(panel())).toBe(sectionAttributes);

    setPanelRender(undefined);
    flush();
    expect(panel().tagName).toBe('DIV');
    expectNativePath(panel());
    expect(attributes(panel())).toBe(sectionAttributes);

    setTriggerRender(() => renderSpan);
    flush();
    expect(trigger().tagName).toBe('SPAN');
    expectNativePath(trigger());

    screen.getByText('Toggle').click();
    flush();
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    // The close defers `ending` by a frame, then unmounts the panel.
    await waitFor(() => expect(screen.queryByTestId('panel')).toBeNull());
  });

  it('swaps an Accordion panel between a function and a tag, natively', () => {
    const [panelRender, setPanelRender] = createSignal<Forwarded>(undefined);
    function ForwardPanel(props: { render?: Forwarded }) {
      return (
        <Accordion.Panel data-testid="panel" render={props.render}>
          Content
        </Accordion.Panel>
      );
    }
    render(() => (
      <Accordion.Root defaultValue={['one']}>
        <Accordion.Item value="one">
          <Accordion.Header>
            <Accordion.Trigger>Toggle</Accordion.Trigger>
          </Accordion.Header>
          <ForwardPanel render={panelRender()} />
        </Accordion.Item>
      </Accordion.Root>
    ));
    const panel = () => screen.getByTestId('panel');
    expect(panel().tagName).toBe('DIV');
    expectNativePath(panel());
    const divAttributes = attributes(panel());

    setPanelRender(() => renderSection);
    flush();
    expect(panel().tagName).toBe('SECTION');
    expectNativePath(panel());
    expect(attributes(panel())).toBe(divAttributes);
    expect(panel()).toHaveAttribute('role', 'region');
  });
});
