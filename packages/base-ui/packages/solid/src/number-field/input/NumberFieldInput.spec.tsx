import type { JSX } from '@solidjs/web';
import { expectType } from '#test-utils';
import { NumberField } from '@solidports/base-ui/number-field';

// Solid: native attribute types come from the `@solidjs/web` JSX namespace (`readonly`, not `readOnly`).
// `NumberField.Input` exposes the native `<input>` props in its `render` callback.
<NumberField.Input
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
