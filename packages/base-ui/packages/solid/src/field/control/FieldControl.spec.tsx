import { Field } from '@solidports/base-ui/field';

function App() {
  let ref!: HTMLTextAreaElement;
  return <Field.Control ref={ref as any} render="textarea" />;
}
