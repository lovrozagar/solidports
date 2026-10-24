import { createComponent, createSignal } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { OTPField } from '@solidports/base-ui/otp-field';

/*
 * OTPField across hydration (D33 server batch, S.2). A plain root and its slots render natively
 * on the server and the hydrating client: the server prints each slot's character as its `value`
 * (`serverFormState`) and the hidden input's value, and the client keeps both as properties. The
 * guards force a path through props whose shape both compiles give alike.
 */

/** A wrapper forwarding its ref: static on both sides, so native. */
function ForwardRef(props: { ref?: OTPField.Input.Props['ref'] }) {
  return <OTPField.Input ref={props.ref} data-testid="c-ref-forward" />;
}

const [renderFlag] = createSignal(false);
const rootSpread = { defaultValue: '42' };
const slotSpread = { 'aria-label': 'spread slot' };
let forwardTarget: HTMLInputElement | undefined;
let getterTarget: HTMLInputElement | undefined;

export function OTPFieldFixture() {
  return (
    <div>
      <OTPField.Root data-testid="a-root" name="a" defaultValue="42" length={2}>
        <OTPField.Input data-testid="a-0" />
        <OTPField.Input data-testid="a-1" />
      </OTPField.Root>
      {/* A spread beside other props: the root's slow path on both sides, its slots native. */}
      <OTPField.Root {...rootSpread} data-testid="b-root" name="b" length={2}>
        <OTPField.Input data-testid="b-0" />
        <OTPField.Input data-testid="b-1" />
      </OTPField.Root>
      <OTPField.Root data-testid="c-root" name="c" defaultValue="1234" length={4}>
        <ForwardRef
          ref={(el: HTMLInputElement | null) => {
            forwardTarget = el ?? undefined;
          }}
        />
        <OTPField.Input data-testid="c-render-getter" render={renderFlag() ? 'input' : undefined} />
        <OTPField.Input {...slotSpread} data-testid="c-spread" />
        {createComponent(OTPField.Input, {
          get ref() {
            return (el: HTMLInputElement) => {
              getterTarget = el;
            };
          },
          'data-testid': 'c-getter-ref',
        } as OTPField.Input.Props) as unknown as JSX.Element}
      </OTPField.Root>
    </div>
  );
}

export const forwardedRef = () => forwardTarget;
export const getterRef = () => getterTarget;

/** `count` OTP fields of two slots each: a budget's copies. */
export function OTPFieldBudget(props: { count: number }) {
  return (
    <div>
      {Array.from({ length: props.count }, (_, i) => (
        <OTPField.Root name={`f${i}`} defaultValue="42" length={2}>
          <OTPField.Input />
          <OTPField.Input />
        </OTPField.Root>
      ))}
    </div>
  );
}
