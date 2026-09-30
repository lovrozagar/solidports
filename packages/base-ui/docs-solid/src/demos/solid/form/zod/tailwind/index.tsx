import { createSignal } from "solid-js";
import { z } from 'zod';
import { Field } from '@solidports/base-ui/field';
import { Form } from '@solidports/base-ui/form';
import { Button } from '@solidports/base-ui/button';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.coerce.number('Age must be a number').positive('Age must be a positive number'),
});

async function submitForm(formValues: Form.Values) {
  const result = schema.safeParse(formValues);

  if (!result.success) {
    return {
      errors: z.flattenError(result.error).fieldErrors,
    };
  }

  return {
    errors: {},
  };
}

export default function Page() {
  const [errors, setErrors] = createSignal({});

  return (
    <Form
      class="flex w-full max-w-64 flex-col gap-4"
      errors={errors()}
      onFormSubmit={async (formValues) => {
        const response = await submitForm(formValues);
        setErrors(response.errors);
      }}
    >
      <Field.Root name="name" class="flex flex-col items-start gap-1">
        <Field.Label class="text-sm font-medium text-gray-900">Name</Field.Label>
        <Field.Control
          placeholder="Enter name"
          class="h-10 w-full rounded-md border border-gray-200 pl-3.5 text-base text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
        />
        <Field.Error class="text-sm text-red-800" />
      </Field.Root>
      <Field.Root name="age" class="flex flex-col items-start gap-1">
        <Field.Label class="text-sm font-medium text-gray-900">Age</Field.Label>
        <Field.Control
          placeholder="Enter age"
          class="h-10 w-full rounded-md border border-gray-200 pl-3.5 text-base text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
        />
        <Field.Error class="text-sm text-red-800" />
      </Field.Root>
      <Button
        type="submit"
        class="flex items-center justify-center h-10 px-3.5 m-0 outline-0 border border-gray-200 rounded-md bg-gray-50 font-inherit text-base font-medium leading-6 text-gray-900 select-none hover:data-[disabled]:bg-gray-50 hover:bg-gray-100 active:data-[disabled]:bg-gray-50 active:bg-gray-200 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:border-t-gray-300 active:data-[disabled]:shadow-none active:data-[disabled]:border-t-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 focus-visible:-outline-offset-1 data-[disabled]:text-gray-500"
      >
        Submit
      </Button>
    </Form>
  );
}
