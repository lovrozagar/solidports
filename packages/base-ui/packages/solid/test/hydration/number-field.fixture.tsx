import { createComponent, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { NumberField } from '@solidports/base-ui/number-field';

/*
 * NumberField.Input across hydration (D33 batch 4a-1). The plain inputs render natively on the
 * server and the hydrating client; the guards force a path through props whose shape both compiles
 * give alike (`test/ssr/compile-agreement.test.ts`), so each side takes the same one.
 */

/** A wrapper forwarding its ref: a `ref(el)` method on both sides, static, so native. */
function ForwardRef(props: { ref?: NumberField.Input.Props['ref'] }) {
  return (
    <NumberField.Root defaultValue={7}>
      <NumberField.Input ref={props.ref} data-testid="ref-forward" />
    </NumberField.Root>
  );
}

const [renderFlag] = createSignal(false);
const spreadProps = { 'aria-label': 'spread' };
const currency = { style: 'currency', currency: 'USD' } as const;
let forwardTarget: HTMLInputElement | undefined;
let getterTarget: HTMLInputElement | undefined;

export function NumberFieldFixture() {
  return (
    <div>
      <NumberField.Root defaultValue={3}>
        <NumberField.Input data-testid="uncontrolled" />
      </NumberField.Root>
      <NumberField.Root value={42} onValueChange={() => {}}>
        <NumberField.Input data-testid="controlled" />
      </NumberField.Root>
      <NumberField.Root defaultValue={1234.5} format={currency}>
        <NumberField.Input data-testid="formatted" />
      </NumberField.Root>
      <NumberField.Root>
        <NumberField.Input data-testid="bare" />
      </NumberField.Root>
      <ForwardRef
        ref={(el: HTMLInputElement | null) => {
          forwardTarget = el ?? undefined;
        }}
      />
      {/* A reactive `render`: a getter on both sides, so the slow path. */}
      <NumberField.Root defaultValue={5}>
        <NumberField.Input data-testid="render-getter" render={renderFlag() ? 'input' : undefined} />
      </NumberField.Root>
      {/* A spread beside other props: a `mergeProps` proxy on both sides, so the slow path. */}
      <NumberField.Root defaultValue={6}>
        <NumberField.Input {...spreadProps} data-testid="spread" />
      </NumberField.Root>
      {/* A getter `ref`, the one dynamic-ref shape: a getter on both sides, so the slow path. */}
      <NumberField.Root defaultValue={8}>
        {
          createComponent(NumberField.Input, {
            get ref() {
              return (el: HTMLInputElement) => {
                getterTarget = el;
              };
            },
            'data-testid': 'getter-ref',
          } as NumberField.Input.Props) as unknown as JSX.Element
        }
      </NumberField.Root>
    </div>
  );
}

export const forwardedRef = () => forwardTarget;
export const getterRef = () => getterTarget;

/** `count` number fields, each a Root with one input: a budget's copies. */
export function NumberFieldBudget(props: { count: number }) {
  return (
    <div>
      {Array.from({ length: props.count }, () => (
        <NumberField.Root defaultValue={1}>
          <NumberField.Input />
        </NumberField.Root>
      ))}
    </div>
  );
}
