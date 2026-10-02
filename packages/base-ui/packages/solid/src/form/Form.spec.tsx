import { expectType } from '#test-utils';
import { Form } from '@solidports/base-ui/form';

interface Values {
  name: string;
  age: number;
}

<Form<Values>
  onFormSubmit={(values) => {
    expectType<string, typeof values.name>(values.name);
    expectType<number, typeof values.age>(values.age);
    // @ts-expect-error
    values.email.startsWith('a');
  }}
/>;

// `Form` exposes the native `<form>` props in its `render` callback.
// Solid: render callbacks are contextually typed as `any` by the shared `render` union in
// `utils/types.ts`, so the React assertion on `props.noValidate` cannot be expressed yet.
<Form render={(props) => <form {...props} />} />;
