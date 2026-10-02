import type { JSX } from '@solidjs/web';
import { expectType } from '#test-utils';
import { OTPField } from '@solidports/base-ui/otp-field';

// @ts-expect-error - slot order is inferred from render order
const noExplicitIndexSupport = <OTPField.Input index={0} />;
void noExplicitIndexSupport;

// Solid: native attribute types come from the `@solidjs/web` JSX namespace (`readonly`, not `readOnly`).
// `OTPField.Input` exposes the native `<input>` props in its `render` callback.
<OTPField.Input
  render={(props) => {
    expectType<JSX.InputHTMLAttributes<HTMLInputElement>['disabled'], typeof props.disabled>(
      props.disabled,
    );
    expectType<JSX.InputHTMLAttributes<HTMLInputElement>['readonly'], typeof props.readonly>(
      props.readonly,
    );
    return <input {...props} />;
  }}
/>;
