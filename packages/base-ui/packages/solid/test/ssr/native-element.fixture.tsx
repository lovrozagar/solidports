import { renderToString } from '@solidjs/web';
import { renderNativeElement } from '../../src/utils/native/element';
import type { SetAttribute } from '../../src/utils/native/element';

const DIV = {
  tag: 'div',
  attributes: { role: 'group' },
  create: () => (<div role="group" />) as unknown as Element,
};
const OWN: ReadonlySet<string> = new Set();

/** A native `<div>` with `props`, whose part writes its attributes with `write`, server-rendered. */
function render(props: object, write: (set: SetAttribute) => void) {
  return renderToString(
    () => renderNativeElement(DIV, props, { own: OWN, reactive: false, attributes: write }) as never,
  );
}

/** The part writes `data-a`, overrides the template's `role`, and with `twice` writes `data-a` again. */
export function renderWrites(twice: boolean) {
  return render({}, (w) => {
    w.set('data-a', '1');
    w.set('role', 'region');
    if (twice) {
      w.set('data-a', '2');
    }
  });
}

/** A part attribute and a consumer attribute whose values hold every character markup escapes. */
export function renderEscaped(value: string) {
  return render({ title: value }, (w) => w.set('data-value', value));
}

/** A consumer prop that collides with a part attribute: the consumer's value wins, once. */
export function renderCollision() {
  return render({ 'aria-expanded': 'consumer', id: 'consumer-id' }, (w) => {
    w.set('aria-expanded', 'part');
    w.set('id', 'part-id');
    w.set('data-panel-open', '');
  });
}
