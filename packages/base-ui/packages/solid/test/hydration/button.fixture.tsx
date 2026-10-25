import { createComponent, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Button } from '@solidports/base-ui/button';
import { Toolbar } from '@solidports/base-ui/toolbar';

/*
 * Button across hydration (D33 batch 4a-1). The plain buttons render natively on the server and
 * the hydrating client; the guards force a path through props whose shape both compiles give alike
 * (`test/ssr/compile-agreement.test.ts`), so each side takes the same one.
 */

/** A wrapper forwarding its ref: a `ref(el)` method on both sides, static, so native. */
function ForwardRef(props: { ref?: Button.Props['ref'] }) {
  return (
    <Button ref={props.ref} data-testid="ref-forward">
      Forward
    </Button>
  );
}

const [flag] = createSignal(false);
const spreadProps = { 'aria-label': 'spread' };
let presses = 0;
const pressed = () => {
  presses += 1;
};
let forwardTarget: HTMLElement | undefined;
let getterTarget: HTMLElement | undefined;

export function ButtonFixture() {
  return (
    <div>
      <Button data-testid="plain">Plain</Button>
      <Button data-testid="disabled" disabled>
        Disabled
      </Button>
      <Button data-testid="focusable" disabled focusableWhenDisabled>
        Focusable
      </Button>
      <Button data-testid="reactive-disabled" disabled={flag()}>
        Reactive
      </Button>
      <Button data-testid="submit" type="submit" tabindex={-1}>
        Submit
      </Button>
      <Button data-testid="handler" onClick={pressed}>
        Handler
      </Button>
      <Button data-testid="class-fn" class={(state) => (state.disabled ? 'off' : 'on')}>
        Class
      </Button>
      <ForwardRef
        ref={(el: HTMLElement | null) => {
          forwardTarget = el ?? undefined;
        }}
      />
      {/* A reactive `render`: a getter on both sides, so the slow path. */}
      <Button data-testid="render-getter" render={flag() ? 'button' : undefined}>
        Render
      </Button>
      {/* A spread beside other props: a `mergeProps` proxy on both sides, so the slow path. */}
      <Button {...spreadProps} data-testid="spread">
        Spread
      </Button>
      {/* A dynamic staticKey: a getter on both sides, so the slow path. */}
      <Button data-testid="native-button" nativeButton={!flag()}>
        Native button
      </Button>
      {/* Inside a composite root, a button takes the composite path on both sides. */}
      <Toolbar.Root>
        <Button data-testid="composite">Composite</Button>
      </Toolbar.Root>
      {/* A getter `ref`, the one dynamic-ref shape: a getter on both sides, so the slow path. */}
      {
        createComponent(Button, {
          get ref() {
            return (el: HTMLElement) => {
              getterTarget = el;
            };
          },
          'data-testid': 'getter-ref',
          children: 'Getter ref',
        } as Button.Props) as unknown as JSX.Element
      }
    </div>
  );
}

export const forwardedRef = () => forwardTarget;
export const getterRef = () => getterTarget;
/** How many times the `handler` button's `onClick` ran. */
export const pressCount = () => presses;

/** `count` buttons: a budget's copies. */
export function ButtonBudget(props: { count: number }) {
  return <div>{Array.from({ length: props.count }, () => <Button>Button</Button>)}</div>;
}
