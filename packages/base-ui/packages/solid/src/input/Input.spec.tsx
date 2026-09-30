import { Input } from '@solidports/base-ui/input';

function App() {
  let ref!: HTMLTextAreaElement;
  return <Input ref={ref as any} render="textarea" />;
}
