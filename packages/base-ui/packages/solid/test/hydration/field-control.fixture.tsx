import { createComponent, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { Field } from '@solidports/base-ui/field';
import { Input } from '@solidports/base-ui/input';

/*
 * Field.Control and Input across hydration (D33 server batch, S.1). The plain cases render
 * natively on the server and the hydrating client; the guards force a path through props whose
 * shape both compiles give alike (`test/ssr/compile-agreement.test.ts`), so each side takes the
 * same one.
 */

/** A wrapper forwarding its ref: a `ref(el)` method on both sides, static, so native. */
function ForwardRef(props: { ref?: Field.Control.Props['ref'] }) {
  return <Field.Control ref={props.ref} data-testid="ref-forward" defaultValue="Rae" />;
}

const [renderFlag] = createSignal(false);
const spreadProps = { defaultValue: 'Sam' };
let forwardTarget: HTMLInputElement | undefined;
let getterTarget: HTMLInputElement | undefined;

export function FieldControlFixture() {
  return (
    <div>
      <Field.Root name="first">
        <Field.Control data-testid="uncontrolled" defaultValue="Ada" />
      </Field.Root>
      <Field.Root name="second">
        <Field.Control data-testid="controlled" value="Bo" onValueChange={() => {}} />
      </Field.Root>
      <Field.Control data-testid="bare" defaultValue="Cy" />
      <Field.Root name="third">
        <Input data-testid="input" defaultValue="Di" />
      </Field.Root>
      <ForwardRef
        ref={(el: HTMLInputElement | null) => {
          forwardTarget = el ?? undefined;
        }}
      />
      {/* A reactive `render`: a getter on both sides, so the slow path. */}
      <Field.Control data-testid="render-getter" render={renderFlag() ? 'input' : undefined} />
      {/* A spread beside other props: a `mergeProps` proxy on both sides, so the slow path. */}
      <Field.Control {...spreadProps} data-testid="spread" />
      {/* A getter `ref`, the one dynamic-ref shape: a getter on both sides, so the slow path. */}
      {
        createComponent(Field.Control, {
          get ref() {
            return (el: HTMLInputElement) => {
              getterTarget = el;
            };
          },
          'data-testid': 'getter-ref',
        } as Field.Control.Props) as unknown as JSX.Element
      }
    </div>
  );
}

export const forwardedRef = () => forwardTarget;
export const getterRef = () => getterTarget;

/** `count` fields, each a Field.Root with one control: a budget's copies. */
export function FieldControlBudget(props: { count: number }) {
  return (
    <div>
      {Array.from({ length: props.count }, (_, i) => (
        <Field.Root name={`f${i}`}>
          <Field.Control defaultValue="v" />
        </Field.Root>
      ))}
    </div>
  );
}
