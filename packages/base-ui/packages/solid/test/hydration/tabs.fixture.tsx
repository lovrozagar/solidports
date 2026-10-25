import { createComponent, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Tabs } from '@solidports/base-ui/tabs';

/*
 * Tabs across hydration (D33 batch 4a-1). Plain parts render natively on the server and the
 * hydrating client; the guards force a path through props whose shape both compiles give alike
 * (`test/ssr/compile-agreement.test.ts`), so each side takes the same one. The indicator's
 * prehydration script positions it from the server markup before hydration.
 */

/** Two tabs and their panels, rendered on the server and hydrated on the client. */
export function TabsFixture() {
  return (
    <Tabs.Root defaultValue="one">
      <Tabs.List>
        <Tabs.Tab value="one">One</Tabs.Tab>
        <Tabs.Tab value="two">Two</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="one">Panel one</Tabs.Panel>
      <Tabs.Panel value="two">Panel two</Tabs.Panel>
    </Tabs.Root>
  );
}

const [flag] = createSignal(false);
const tabSpread = { value: 'spread' };
const panelSpread = { value: 'spread', keepMounted: true };
let forwardTarget: HTMLElement | undefined;
let getterTarget: HTMLElement | undefined;

/** A wrapper forwarding its ref: a `ref(el)` method on both sides, static, so native. */
function ForwardRef(props: { ref?: Tabs.Tab.Props['ref'] }) {
  return (
    <Tabs.Tab ref={props.ref} value="forward" data-testid="d-ref-forward">
      Forward
    </Tabs.Tab>
  );
}

/** Three tabs, their panels and an indicator, every part plain, beside the path-forcing guards. */
export function TabsPathsFixture() {
  return (
    <div>
      <Tabs.Root data-testid="a-root" defaultValue="one">
        <Tabs.List data-testid="a-list">
          <Tabs.Tab data-testid="a-tab-one" value="one">
            One
          </Tabs.Tab>
          <Tabs.Tab data-testid="a-tab-two" value="two">
            Two
          </Tabs.Tab>
          <Tabs.Tab data-testid="a-tab-three" value="three">
            Three
          </Tabs.Tab>
          <Tabs.Indicator data-testid="a-indicator" />
        </Tabs.List>
        <Tabs.Panel data-testid="a-panel-one" value="one" keepMounted>
          Panel one
        </Tabs.Panel>
        <Tabs.Panel data-testid="a-panel-two" value="two" keepMounted>
          Panel two
        </Tabs.Panel>
        <Tabs.Panel data-testid="a-panel-three" value="three" keepMounted>
          Panel three
        </Tabs.Panel>
      </Tabs.Root>
      <Tabs.Root defaultValue="forward">
        <Tabs.List>
          <ForwardRef
            ref={(el: HTMLElement | null) => {
              forwardTarget = el ?? undefined;
            }}
          />
          {/* A reactive `render`: a getter on both sides, so the slow path. */}
          <Tabs.Tab
            data-testid="d-render-getter"
            value="render"
            render={flag() ? 'button' : undefined}
          >
            Render
          </Tabs.Tab>
          {/* A spread beside other props: a `mergeProps` proxy on both sides, so the slow path. */}
          <Tabs.Tab {...tabSpread} data-testid="d-spread">
            Spread
          </Tabs.Tab>
          {/* A dynamic staticKey: a getter on both sides, so the slow path. */}
          <Tabs.Tab data-testid="d-native-button" value="native-button" nativeButton={!flag()}>
            Native button
          </Tabs.Tab>
          {/* A getter `ref`, the one dynamic-ref shape: a getter on both sides, so the slow path. */}
          {
            createComponent(Tabs.Tab, {
              get ref() {
                return (el: HTMLElement) => {
                  getterTarget = el;
                };
              },
              value: 'getter-ref',
              'data-testid': 'd-getter-ref',
              children: 'Getter ref',
            } as Tabs.Tab.Props) as unknown as JSX.Element
          }
        </Tabs.List>
        <Tabs.Panel {...panelSpread} data-testid="d-panel-spread">
          Spread panel
        </Tabs.Panel>
      </Tabs.Root>
    </div>
  );
}

export const forwardedRef = () => forwardTarget;
export const getterRef = () => getterTarget;

/**
 * A part as-is, or forced onto the slow path on both sides by a getter `ref` (the one shape the
 * compiles agree is dynamic): the scripted tabs' native and slow renders.
 */
function part<P extends object>(slow: boolean, component: (props: P) => JSX.Element, props: P) {
  if (!slow) {
    return createComponent(component, props);
  }
  // The descriptors, not a spread: a spread would read the `children` getter outside the root.
  const forced = Object.defineProperties({}, Object.getOwnPropertyDescriptors(props)) as P;
  Object.defineProperty(forced, 'ref', { get: () => undefined, enumerable: true });
  return createComponent(component, forced);
}

/** Tabs whose indicator renders the prehydration script, every part native or every part slow. */
export function ScriptedTabs(props: { slow: boolean }) {
  return part(props.slow, Tabs.Root, {
    defaultValue: 'two',
    get children() {
      return part(props.slow, Tabs.List, {
        get children() {
          return [
            part(props.slow, Tabs.Tab, { value: 'one', 'data-testid': 's-tab-one', children: 'One' }),
            part(props.slow, Tabs.Tab, { value: 'two', 'data-testid': 's-tab-two', children: 'Two' }),
            part(props.slow, Tabs.Indicator, {
              renderBeforeHydration: true,
              'data-testid': 's-indicator',
            } as Tabs.Indicator.Props),
          ];
        },
      } as Tabs.List.Props);
    },
  } as Tabs.Root.Props);
}

/** One Tabs root with `count` tabs and their panels: a budget's copies. */
export function TabsBudget(props: { count: number }) {
  return (
    <Tabs.Root defaultValue="t0">
      <Tabs.List>
        {Array.from({ length: props.count }, (_, i) => (
          <Tabs.Tab value={`t${i}`}>Tab</Tabs.Tab>
        ))}
      </Tabs.List>
      {Array.from({ length: props.count }, (_, i) => (
        <Tabs.Panel value={`t${i}`}>Panel</Tabs.Panel>
      ))}
    </Tabs.Root>
  );
}
