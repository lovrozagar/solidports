import type { JSX } from '@solidjs/web';
import { renderNativeElement } from '../../src/utils/native/element';
import type { SetAttribute } from '../../src/utils/native/element';

/*
 * A native part whose second props source wins over the consumer's attributes
 * (`attributeOverrides`): the server writes the overrides above the consumer's literal and
 * reactive keys, so hydration claims the element with the same attributes and reports no
 * mismatch.
 */

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const OWN_KEYS: ReadonlySet<string> = new Set(['overrides']);

interface OverrideProps {
  overrides: Record<string, string>;
  [key: string]: unknown;
}

function writeOverrides(w: SetAttribute, props: OverrideProps) {
  for (const [key, value] of Object.entries(props.overrides)) {
    w.set(key, value);
  }
}

function OverridePart(props: OverrideProps): JSX.Element {
  return renderNativeElement(DIV, props, {
    own: OWN_KEYS,
    attributes: (w: SetAttribute) => w.set('title', 'part'),
    attributeOverrides: writeOverrides,
    partClass: () => 'part',
    handlerTarget: props,
    reactive: true,
  }) as unknown as JSX.Element;
}

/**
 * The part with a literal consumer key the override replaces, a key only the override sets, and a
 * part class beside the consumer's.
 */
export function AttributeOverridesFixture() {
  return (
    <OverridePart
      data-testid="override-part"
      aria-label="literal"
      class="consumer"
      overrides={{ 'aria-label': 'override', title: 'override title', 'data-extra': 'x' }}
    />
  );
}
