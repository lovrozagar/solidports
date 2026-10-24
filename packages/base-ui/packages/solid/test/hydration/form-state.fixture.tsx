import { isServer } from '@solidjs/web';
import type { JSX } from '@solidjs/web';
import { renderNativeElement } from '../../src/utils/native/element';
import type { SetAttribute } from '../../src/utils/native/element';

/*
 * Native form controls across hydration (D33 server batch, S.0). A control prints its state on the
 * server as attributes and holds it as properties on the client, as the slow path's
 * `useRenderElement` does: an uncontrolled control renders `value` on the server and
 * `defaultValue` on the client, a controlled one `value` on both, and an OTP-style slot prints a
 * value only the server renderer writes (`serverFormState`).
 */

const INPUT = { tag: 'input', create: () => (<input />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['initial', 'controlled', 'slot']);

interface ControlProps {
  initial: string;
  controlled?: boolean;
  [key: string]: unknown;
}

/** Field.Control's value write: `value` on the server or when controlled, else `defaultValue`. */
function writeValue(w: SetAttribute, props: ControlProps) {
  if (props.controlled || isServer) {
    w.set('value', props.initial);
  } else {
    w.set('defaultValue', props.initial);
  }
}

function Control(props: ControlProps): JSX.Element {
  return renderNativeElement(INPUT, props, {
    own: OWN_KEYS,
    attributes: writeValue,
    handlerTarget: props,
    reactive: false,
  }) as unknown as JSX.Element;
}

interface SlotProps {
  slot: string;
  [key: string]: unknown;
}

const writeSlotValue = (w: SetAttribute, props: SlotProps) => w.set('value', props.slot);

/** An OTP slot: the server prints the character as `value`; the client sets the property itself. */
function Slot(props: SlotProps): JSX.Element {
  return renderNativeElement(INPUT, props, {
    own: OWN_KEYS,
    serverFormState: writeSlotValue,
    handlerTarget: props,
    reactive: false,
  }) as unknown as JSX.Element;
}

export function FormStateFixture() {
  return (
    <div>
      <Control data-testid="uncontrolled" initial="Ada" />
      <Control data-testid="controlled" initial="Bo" controlled />
      <Slot data-testid="slot" slot="7" />
    </div>
  );
}
