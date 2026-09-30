import { createSignal } from "solid-js"
import { Field } from "@solidports/base-ui/field"
import { Form } from "@solidports/base-ui/form"
import { Button } from "@solidports/base-ui/button"

type ServerErrors = { username?: string }

export default function ActionStateForm() {
  const [serverErrors, setServerErrors] = createSignal<ServerErrors>({})
  const [loading, setLoading] = createSignal(false)

  return (
    <Form
      errors={serverErrors()}
      class="flex w-full max-w-64 flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault()
        const formData = new FormData(event.currentTarget)
        setLoading(true)
        const res = await submitForm(formData)
        setServerErrors(res.serverErrors ?? {})
        setLoading(false)
      }}
    >
      <Field.Root name="username" class="flex flex-col items-start gap-1">
        <Field.Label class="text-sm font-medium text-gray-900">Username</Field.Label>
        <Field.Control
          type="text"
          required
          value="admin"
          placeholder="e.g. alice132"
          class="h-10 w-full rounded-md border border-gray-200 pl-3.5 text-base text-gray-900 focus:outline focus:outline-2 focus:-outline-offset-1 focus:outline-blue-800"
        />
        <Field.Error class="text-sm text-red-800" />
      </Field.Root>
      <Button
        type="submit"
        disabled={loading()}
        focusableWhenDisabled
        class="flex items-center justify-center h-10 px-3.5 m-0 outline-0 border border-gray-200 rounded-md bg-gray-50 font-inherit text-base font-medium leading-6 text-gray-900 select-none hover:data-[disabled]:bg-gray-50 hover:bg-gray-100 active:data-[disabled]:bg-gray-50 active:bg-gray-200 active:shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] active:border-t-gray-300 active:data-[disabled]:shadow-none active:data-[disabled]:border-t-gray-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-800 focus-visible:-outline-offset-1 data-[disabled]:text-gray-500"
      >
        Submit
      </Button>
    </Form>
  )
}

async function submitForm(formData: FormData): Promise<{ serverErrors?: ServerErrors }> {
  await new Promise((resolve) => setTimeout(resolve, 1000))
  const username = formData.get("username") as string | null
  if (username === "admin") {
    return { serverErrors: { username: "'admin' is reserved for system use" } }
  }
  const success = Math.random() > 0.5
  if (!success) {
    return { serverErrors: { username: `${username} is unavailable` } }
  }
  return {}
}
