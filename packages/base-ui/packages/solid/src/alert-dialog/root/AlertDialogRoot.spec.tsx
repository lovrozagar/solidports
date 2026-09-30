import { expectType } from '#test-utils';
import { AlertDialog } from '@solidports/base-ui/alert-dialog';

const numberPayloadHandle = AlertDialog.createHandle<number>();

const rootWithDirectChildren = (
  <AlertDialog.Root handle={numberPayloadHandle}>
    <AlertDialog.Portal />
  </AlertDialog.Root>
);

const rootWithFunctionChildren = (
  <AlertDialog.Root handle={numberPayloadHandle}>
    {(data) => {
      expectType<number | undefined, typeof data.payload>(data.payload);
      return null;
    }}
  </AlertDialog.Root>
);

const triggerWithPayload = <AlertDialog.Trigger handle={numberPayloadHandle} payload={42} />;
const triggerWithoutPayload = <AlertDialog.Trigger handle={numberPayloadHandle} />;

const triggerWithInvalidPayload = (
  // @ts-expect-error
  <AlertDialog.Trigger handle={numberPayloadHandle} payload={'invalid'} />
);
