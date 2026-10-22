/* eslint-disable testing-library/no-container -- the cases compare the rendered element itself */
/*
 * GOTCHA-020: a `Show` hands a function child that takes no parameter (`children: () => ...`) to
 * whoever reads it, unresolved, while it resolves a JSX child and a callback child (one that takes
 * the condition) itself. Sibling `Show`s passed together as a
 * component's children are read by the one computation that inserts that children array, so when
 * a sibling changes (a `Show` toggles) that computation calls the function child of a `Show` whose
 * condition never changed again, and what it built is replaced. `Show`s in separate JSX
 * expressions are separate inserts and are unaffected. A native branch builds its element once
 * instead.
 */
import { createComponent, createSignal, flush, Show } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { describe, expect, it } from 'vitest';
import { createRenderer } from '#test-utils';

function Parent(props: { children?: JSX.Element }) {
  return <div>{props.children}</div>;
}

describe('GOTCHA-020: a sibling re-reads a Show branch whose condition held', () => {
  const { render } = createRenderer();

  /** `first` and a `Show` that turns on, together as `Parent`'s children. */
  function mount(first: () => JSX.Element, separate = false) {
    const [second, setSecond] = createSignal(false);
    const toggled = () =>
      createComponent(Show, {
        get when() {
          return second();
        },
        children: () => <i />,
      });
    const view = render(() =>
      separate ? (
        <div>
          {first()}
          {toggled()}
        </div>
      ) : (
        <Parent>
          {first()}
          {toggled()}
        </Parent>
      ),
    );
    flush();
    return {
      span: () => view.container.querySelector('span'),
      showSecond: () => {
        setSecond(true);
        flush();
      },
    };
  }

  const counted = (count: { builds: number }) => () => {
    count.builds += 1;
    return <span />;
  };

  it('calls a function child again and replaces what it built', () => {
    const count = { builds: 0 };
    const { span, showSecond } = mount(() =>
      createComponent(Show, { when: true, children: counted(count) }),
    );
    const before = span();

    showSecond();

    expect(count.builds).toBe(2);
    expect(span()).not.toBe(before);
  });

  it('keeps a callback child, which takes the condition and the Show resolves itself', () => {
    const count = { builds: 0 };
    const build = counted(count);
    const { span, showSecond } = mount(() => <Show when={1}>{(_value) => build()}</Show>);
    const before = span();

    showSecond();

    expect(count.builds).toBe(1);
    expect(span()).toBe(before);
  });

  it('keeps a JSX child, which the Show resolves itself', () => {
    const count = { builds: 0 };
    const build = counted(count);
    const { span, showSecond } = mount(() => <Show when>{build()}</Show>);
    const before = span();

    showSecond();

    expect(count.builds).toBe(1);
    expect(span()).toBe(before);
  });

  it('leaves a Show in a separate JSX expression alone', () => {
    const count = { builds: 0 };
    const { span, showSecond } = mount(
      () => createComponent(Show, { when: true, children: counted(count) }),
      true,
    );
    const before = span();

    showSecond();

    expect(count.builds).toBe(1);
    expect(span()).toBe(before);
  });

  it('keeps an element built once', () => {
    const count = { builds: 0 };
    const build = counted(count);
    let element: JSX.Element | undefined;
    const { span, showSecond } = mount(() =>
      createComponent(Show, {
        when: true,
        children: () => {
          element ??= build();
          return element;
        },
      }),
    );
    const before = span();

    showSecond();

    expect(count.builds).toBe(1);
    expect(span()).toBe(before);
  });
});
