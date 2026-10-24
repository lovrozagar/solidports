/*
 * A native element's attribute effect re-runs for any input it reads, and writes only what changed:
 * Solid's `assign` receives the changed keys, not the whole record, as compiled JSX's grouped
 * effect writes. Handing it every key cost each re-run a fresh record and two `for…in` passes over
 * dictionary-mode objects: an OTP field allocated 76 KB more per arrow-key sweep than its slow path
 * (2,508 `assignProp` calls against 132). Solid's own re-sets stay: a form control's state
 * properties and an object `style`, which it diffs against what it applied, go through every run.
 */
import { createSignal, flush } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import * as web from '@solidjs/web';
import { describe, expect, it, vi } from 'vitest';
import { OTPField } from '@solidports/base-ui/otp-field';
import { createRenderer, isJSDOM } from '#test-utils';
import { renderNativeElement } from './element';
import type { SetAttribute } from './element';

vi.mock('@solidjs/web', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@solidjs/web')>();
  return { ...actual, assign: vi.fn(actual.assign) };
});

/** The keys `assign` received while `act` ran, one entry per key per call, sorted. */
function assignedKeys(act: () => void) {
  const assign = vi.mocked(web.assign);
  assign.mockClear();
  act();
  flush();
  return assign.mock.calls.flatMap(([, props]) => Object.keys(props ?? {})).sort();
}

/** `assignedKeys` for an `act` whose writes land after a microtask (a queued focus move). */
async function assignedKeysSettled(act: () => void) {
  const assign = vi.mocked(web.assign);
  assign.mockClear();
  act();
  await Promise.resolve();
  await Promise.resolve();
  flush();
  return assign.mock.calls.flatMap(([, props]) => Object.keys(props ?? {})).sort();
}

const DIV = { tag: 'div', create: () => (<div />) as unknown as Element };
const INPUT = { tag: 'input', create: () => (<input />) as unknown as Element };
const COLD_KEYS = Array.from({ length: 20 }, (_, i) => `data-cold-${i}`);

interface Target {
  hot: () => number;
  value?: () => string | undefined;
}

/** A part whose effect writes twenty unchanging attributes beside one that changes. */
function writeHotPart(w: SetAttribute, target: Target) {
  for (const key of COLD_KEYS) {
    w.set(key, 'cold');
  }
  w.set('tabindex', target.hot());
  const value = target.value?.();
  if (value !== undefined) {
    w.set('value', value);
  }
}

function HotPart(props: { target: Target; style?: unknown; tag?: 'input' }) {
  return renderNativeElement(props.tag === 'input' ? INPUT : DIV, props, {
    own: new Set(['target', 'tag']),
    attributes: writeHotPart,
    handlerTarget: props.target,
    reactive: true,
  }) as unknown as web.JSX.Element;
}

// The counts spy on `@solidjs/web`'s `assign` through a module mock, which browser mode does not
// apply to a prebundled dependency; the behavior checks run in both.
describe('native attribute effect: writes only what changed', () => {
  const { render } = createRenderer();

  it.skipIf(!isJSDOM)('passes assign only the key whose value changed', () => {
    const [hot, setHot] = createSignal(0);
    render(() => <HotPart target={{ hot }} data-testid="part" />);
    const part = screen.getByTestId('part');
    expect(assignedKeys(() => setHot(1))).toEqual(['tabindex']);
    expect(part.getAttribute('tabindex')).toBe('1');
    expect(part.getAttribute('data-cold-0')).toBe('cold');
  });

  it.skipIf(!isJSDOM)('writes the whole record on mount, against nothing held', async () => {
    const actual = await vi.importActual<typeof web>('@solidjs/web');
    const assign = vi.mocked(web.assign);
    // Keys held before each write, read when it is called: `assign` fills its previous record in.
    const heldBefore: string[][] = [];
    assign.mockImplementation((node, props, isSvg, prevProps, skipRef) => {
      if (props && 'tabindex' in props) {
        heldBefore.push(Object.keys(prevProps ?? {}));
      }
      return actual.assign(node, props, isSvg, prevProps, skipRef);
    });
    try {
      const [hot] = createSignal(0);
      render(() => <HotPart target={{ hot }} />);
    } finally {
      assign.mockImplementation(actual.assign);
    }
    // A diffing first run holds each new key's previous `undefined`; a whole record holds none.
    expect(heldBefore).toEqual([[]]);
  });

  it.skipIf(!isJSDOM)('passes nothing to assign when a re-run changes no value', () => {
    const [hot, setHot] = createSignal(0);
    const [other, setOther] = createSignal(0);
    render(() => <HotPart target={{ hot: () => (other(), hot()) }} />);
    expect(assignedKeys(() => setOther(1))).toEqual([]);
    expect(assignedKeys(() => setHot(2))).toEqual(['tabindex']);
  });

  it("re-sets a form control's value on every run, as Solid does", () => {
    const [hot, setHot] = createSignal(0);
    render(() => <HotPart tag="input" target={{ hot, value: () => 'kept' }} data-testid="part" />);
    const input = screen.getByTestId('part') as HTMLInputElement;
    expect(input.value).toBe('kept');
    input.value = 'typed';
    setHot(1);
    flush();
    expect(input.value).toBe('kept');
  });

  it('writes an object style mutated in place, as Solid does', () => {
    const [hot, setHot] = createSignal(0);
    const style: Record<string, string> = { color: 'red' };
    render(() => <HotPart target={{ hot }} style={style} data-testid="part" />);
    const part = screen.getByTestId('part');
    expect(part.style.color).toBe('red');
    style.color = 'blue';
    setHot(1);
    flush();
    expect(part.style.color).toBe('blue');
  });

  it('removes an attribute a re-run no longer writes', () => {
    const [hot, setHot] = createSignal(0);
    const [value, setValue] = createSignal<string | undefined>('a');
    render(() => <HotPart target={{ hot, value }} data-testid="part" />);
    const part = screen.getByTestId('part');
    expect(part.getAttribute('value')).toBe('a');
    setValue(undefined);
    setHot(1);
    flush();
    expect(part.hasAttribute('value')).toBe(false);
    expect(part.getAttribute('tabindex')).toBe('1');
  });

  it.skipIf(!isJSDOM)('holds exactly the written keys as re-runs add and drop them', () => {
    const [hot, setHot] = createSignal(0);
    const [value, setValue] = createSignal<string | undefined>(undefined);
    render(() => <HotPart target={{ hot, value }} data-testid="part" />);
    const part = screen.getByTestId('part');
    for (let round = 1; round <= 2; round += 1) {
      // Opening adds a key; the same value written again after a drop is new again.
      expect(assignedKeys(() => setValue('a'))).toEqual(['value']);
      expect(part.getAttribute('value')).toBe('a');
      expect(assignedKeys(() => setHot(round * 10))).toEqual(['tabindex']);
      // Closing drops it; a re-run after that changes nothing and drops nothing more.
      expect(assignedKeys(() => setValue(undefined))).toEqual(['value']);
      expect(part.hasAttribute('value')).toBe(false);
      expect(assignedKeys(() => setHot(round * 10 + 1))).toEqual(['tabindex']);
      expect(part.getAttribute('data-cold-19')).toBe('cold');
    }
  });

  it.skipIf(!isJSDOM)(
    "passes assign only the two slots' tabindex when an OTP field's arrow key moves the active slot",
    async () => {
      render(() => (
        <OTPField.Root length={12} defaultValue="0123456789AB" validationType="alphanumeric">
          {Array.from({ length: 12 }, () => (
            <OTPField.Input />
          ))}
        </OTPField.Root>
      ));
      const inputs = screen.getAllByRole('textbox') as HTMLInputElement[];
      const last = inputs[inputs.length - 1];
      last.focus();
      await Promise.resolve();
      flush();
      expect(
        await assignedKeysSettled(() => fireEvent.keyDown(last, { key: 'ArrowLeft' })),
      ).toEqual(['tabindex', 'tabindex']);
      expect(document.activeElement).toBe(inputs[inputs.length - 2]);
    },
  );
});

interface OverrideTarget {
  hot: () => number;
  overrides: () => Record<string, unknown> | undefined;
}

/** A part whose second props source wins over the consumer's attributes (`attributeOverrides`). */
function OverridePart(props: { target: OverrideTarget; [key: string]: unknown }) {
  return renderNativeElement(DIV, props, {
    own: new Set(['target']),
    attributes: (w: SetAttribute, target: OverrideTarget) => {
      w.set('tabindex', target.hot());
      // The part's own write of a key the override sets stays below it.
      w.set('title', 'part');
    },
    attributeOverrides: (w: SetAttribute, target: OverrideTarget) => {
      for (const [key, value] of Object.entries(target.overrides() ?? {})) {
        w.set(key, value);
      }
    },
    handlerTarget: props.target,
    reactive: true,
  }) as unknown as web.JSX.Element;
}

describe('native attribute effect: overrides above the consumer', () => {
  const { render } = createRenderer();

  it('writes a key both the consumer and the override set once, with the override value', () => {
    const [hot, setHot] = createSignal(0);
    const [title, setTitle] = createSignal('consumer');
    const [overrides, setOverrides] = createSignal<Record<string, unknown> | undefined>({
      title: 'override',
    });
    render(() => <OverridePart target={{ hot, overrides }} title={title()} data-testid="part" />);
    const part = screen.getByTestId('part');
    expect(part.getAttribute('title')).toBe('override');
    setTitle('consumer 2');
    setHot(1);
    flush();
    expect(part.getAttribute('title')).toBe('override');
    setOverrides({ title: 'override 2' });
    flush();
    expect(part.getAttribute('title')).toBe('override 2');
  });

  it.skipIf(!isJSDOM)('passes assign an overridden key only when the override changes it', () => {
    const [hot, setHot] = createSignal(0);
    const [title, setTitle] = createSignal('consumer');
    const [overrides, setOverrides] = createSignal<Record<string, unknown> | undefined>({
      title: 'override',
    });
    render(() => <OverridePart target={{ hot, overrides }} title={title()} />);
    // The consumer's change is hidden by the override: nothing to write.
    expect(assignedKeys(() => setTitle('consumer 2'))).toEqual([]);
    // Another key's change writes only that key.
    expect(assignedKeys(() => setHot(1))).toEqual(['tabindex']);
    expect(assignedKeys(() => setOverrides({ title: 'override 2' }))).toEqual(['title']);
    // Dropping the override writes the consumer's value back, once.
    expect(assignedKeys(() => setOverrides(undefined))).toEqual(['title']);
  });

  it("brings the consumer's value back when the override drops its key", () => {
    const [hot] = createSignal(0);
    const [title, setTitle] = createSignal('consumer');
    const [overrides, setOverrides] = createSignal<Record<string, unknown> | undefined>({
      title: 'override',
    });
    render(() => <OverridePart target={{ hot, overrides }} title={title()} data-testid="part" />);
    const part = screen.getByTestId('part');
    setTitle('consumer 2');
    flush();
    expect(part.getAttribute('title')).toBe('override');
    setOverrides(undefined);
    flush();
    expect(part.getAttribute('title')).toBe('consumer 2');
  });

  it('brings a literal consumer value back when the override drops its key', () => {
    const [hot] = createSignal(0);
    const [overrides, setOverrides] = createSignal<Record<string, unknown> | undefined>({
      'aria-label': 'override',
    });
    render(() => (
      <OverridePart target={{ hot, overrides }} aria-label="literal" data-testid="part" />
    ));
    const part = screen.getByTestId('part');
    expect(part.getAttribute('aria-label')).toBe('override');
    setOverrides(undefined);
    flush();
    expect(part.getAttribute('aria-label')).toBe('literal');
    setOverrides({ 'aria-label': 'again' });
    flush();
    expect(part.getAttribute('aria-label')).toBe('again');
  });

  it("brings the part's own value back when the override drops a key the consumer lacks", () => {
    const [hot] = createSignal(0);
    const [overrides, setOverrides] = createSignal<Record<string, unknown> | undefined>({
      title: 'override',
    });
    render(() => <OverridePart target={{ hot, overrides }} data-testid="part" />);
    const part = screen.getByTestId('part');
    expect(part.getAttribute('title')).toBe('override');
    setOverrides(undefined);
    flush();
    expect(part.getAttribute('title')).toBe('part');
  });

  it('removes a key only the override set once it drops it', () => {
    const [hot] = createSignal(0);
    const [overrides, setOverrides] = createSignal<Record<string, unknown> | undefined>(undefined);
    render(() => <OverridePart target={{ hot, overrides }} data-testid="part" />);
    const part = screen.getByTestId('part');
    expect(part.hasAttribute('data-extra')).toBe(false);
    setOverrides({ 'data-extra': 'x' });
    flush();
    expect(part.getAttribute('data-extra')).toBe('x');
    setOverrides(undefined);
    flush();
    expect(part.hasAttribute('data-extra')).toBe(false);
    expect(part.getAttribute('tabindex')).toBe('0');
  });
});

describe('native attribute effect: a part class beside the consumer’s', () => {
  const { render } = createRenderer();

  function ClassPart(props: { extra: () => string | undefined; [key: string]: unknown }) {
    return renderNativeElement(DIV, props, {
      own: new Set(['extra']),
      partClass: props.extra,
      reactive: true,
    }) as unknown as web.JSX.Element;
  }

  it("writes the part's class after the consumer's, and alone without one", () => {
    const [extra, setExtra] = createSignal<string | undefined>('part');
    render(() => <ClassPart extra={extra} class="consumer" data-testid="with" />);
    render(() => <ClassPart extra={extra} data-testid="alone" />);
    expect(screen.getByTestId('with').className).toBe('consumer part');
    expect(screen.getByTestId('alone').className).toBe('part');
    setExtra(undefined);
    flush();
    expect(screen.getByTestId('with').className).toBe('consumer');
    expect(screen.getByTestId('alone').hasAttribute('class')).toBe(false);
  });
});
