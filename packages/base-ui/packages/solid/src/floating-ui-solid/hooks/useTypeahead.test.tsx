import { act } from '#test-utils';
import { render, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, For, Show, untrack } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { vi, expect, beforeEach, describe, it } from 'vitest';
import { defaultProps } from '../../solid-helpers';
import { useClick, useFloating, useInteractions, useTypeahead } from '../index';
import type { UseTypeaheadProps } from './useTypeahead';

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

const useImpl = (
  componentProps: Pick<UseTypeaheadProps, 'onMatch' | 'onTyping'> & {
    list?: Array<string>;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    addUseClick?: boolean;
  },
) => {
  const props = defaultProps(componentProps, { addUseClick: false });
  const [open, setOpen] = createSignal(true);
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null);
  const { refs, context } = useFloating({
    get open() {
      return props.open ?? open();
    },
    get onOpenChange() {
      return props.onOpenChange ?? setOpen;
    },
  });
  const list = props.list ?? ['one', 'two', 'three'];
  const typeahead = useTypeahead({
    context,
    props: {
      listRef: list,
      get activeIndex() {
        return activeIndex();
      },
      onMatch(index) {
        setActiveIndex(index);
        props.onMatch?.(index);
      },
      get onTyping() {
        return props.onTyping;
      },
    },
  });
  const click = useClick({
    context,
    props: {
      get enabled() {
        return props.addUseClick;
      },
    },
  });

  const { getReferenceProps, getFloatingProps } = useInteractions([typeahead, click]);

  return {
    activeIndex,
    open,
    getReferenceProps: (userProps?: JSX.HTMLAttributes<Element>) =>
      getReferenceProps({
        role: 'combobox',
        ...userProps,
        ref: refs.setReference,
      }),
    getFloatingProps: () =>
      getFloatingProps({
        role: 'listbox',
        ref: refs.setFloating,
      }),
  };
};

function Combobox(
  props: Pick<UseTypeaheadProps, 'onMatch' | 'onTyping'> & {
    list?: Array<string>;
  },
) {
  const { getReferenceProps, getFloatingProps } = useImpl(props);
  return (
    <>
      <input {...getReferenceProps()} />
      <div {...getFloatingProps()} />
    </>
  );
}

function ComboboxWithElementsRef(
  props: Pick<UseTypeaheadProps, 'onMatch'> & {
    list?: Array<string>;
    hiddenIndices?: Array<number>;
  },
) {
  const [activeIndex, setActiveIndex] = createSignal<null | number>(null);
  const [open, setOpen] = createSignal(true);
  const { refs, context } = useFloating({
    get open() {
      return open();
    },
    onOpenChange: setOpen,
  });
  const list = props.list ?? ['apple', 'apricot', 'banana'];
  const elements: Array<HTMLElement | null> = [];
  const typeahead = useTypeahead({
    context,
    props: {
      listRef: list,
      elementsRef: elements,
      get activeIndex() {
        return activeIndex();
      },
      onMatch(index) {
        setActiveIndex(index);
        props.onMatch?.(index);
      },
    },
  });

  const { getReferenceProps, getFloatingProps, getItemProps } = useInteractions([typeahead]);

  return (
    <>
      <input {...getReferenceProps({ role: 'combobox', ref: refs.setReference })} />
      <Show when={open()}>
        <div {...getFloatingProps({ role: 'listbox', ref: refs.setFloating })}>
          <For each={list}>
            {(value, index) => (
              <div
                role="option"
                aria-selected={activeIndex() === index() ? 'true' : 'false'}
                style={props.hiddenIndices?.includes(index()) ? { display: 'none' } : undefined}
                {...getItemProps({
                  ref(node: HTMLElement) {
                    // Solid: refs run untracked; read the index without subscribing.
                    elements[untrack(index)] = node;
                  },
                })}
              >
                {value}
              </div>
            )}
          </For>
        </div>
      </Show>
    </>
  );
}

describe('useTypeahead', () => {
  it('rapidly focuses list items when they start with the same letter', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(2);

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('bails out of rapid focus of first letter if the list contains a string that starts with two of the same letter', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} list={['apple', 'aaron', 'apricot']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(0);
  });

  // Solid: there is no StrictMode, so both variants run the same way.
  it.each([false, true])(
    'starts from the current activeIndex and correctly loops (strict: %s)',
    async () => {
      const spy = vi.fn();
      render(() => <Combobox onMatch={spy} list={['Toy Story 2', 'Toy Story 3', 'Toy Story 4']} />);

      await userEvent.click(screen.getByRole('combobox'));

      await userEvent.keyboard('t');
      await userEvent.keyboard('o');
      await userEvent.keyboard('y');
      expect(spy).toHaveBeenCalledWith(0);

      spy.mockReset();

      await userEvent.keyboard('t');
      await userEvent.keyboard('o');
      await userEvent.keyboard('y');
      expect(spy).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(750));

      await userEvent.keyboard('t');
      await userEvent.keyboard('o');
      await userEvent.keyboard('y');
      expect(spy).toHaveBeenCalledWith(1);

      act(() => vi.advanceTimersByTime(750));

      await userEvent.keyboard('t');
      await userEvent.keyboard('o');
      await userEvent.keyboard('y');
      expect(spy).toHaveBeenCalledWith(2);

      act(() => vi.advanceTimersByTime(750));

      await userEvent.keyboard('t');
      await userEvent.keyboard('o');
      await userEvent.keyboard('y');
      expect(spy).toHaveBeenCalledWith(0);
    },
  );

  it('capslock characters continue to match', async () => {
    const spy = vi.fn();
    render(() => <Combobox onMatch={spy} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('{CapsLock}t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not depend on locale-sensitive lowercasing', async () => {
    const toLocaleLowerCase = String.prototype.toLocaleLowerCase;
    const toLocaleLowerCaseSpy = vi
      .spyOn(String.prototype, 'toLocaleLowerCase')
      .mockImplementation(function lowerWithTurkishLocale(this: string) {
        return toLocaleLowerCase.call(this, 'tr');
      });

    try {
      const spy = vi.fn();
      render(() => <Combobox onMatch={spy} list={['Istanbul']} />);

      await userEvent.click(screen.getByRole('combobox'));

      await userEvent.keyboard('i');
      expect(spy).toHaveBeenCalledWith(0);
    } finally {
      toLocaleLowerCaseSpy.mockRestore();
    }
  });

  function App1(props: Pick<UseTypeaheadProps, 'onMatch'> & { list: Array<string> }) {
    const { getReferenceProps, getFloatingProps, activeIndex, open } = useImpl(props);
    let inputRef: HTMLInputElement | undefined;

    return (
      <>
        <div
          {...getReferenceProps({
            onClick: () => inputRef?.focus(),
          })}
        >
          <input
            ref={(node) => {
              inputRef = node;
            }}
            readonly
          />
        </div>
        <Show when={open()}>
          <div {...getFloatingProps()}>
            <For each={props.list}>
              {(value, i) => (
                <div
                  role="option"
                  tabindex={i() === activeIndex() ? 0 : -1}
                  aria-selected={i() === activeIndex() ? 'true' : 'false'}
                >
                  {value}
                </div>
              )}
            </For>
          </div>
        </Show>
      </>
    );
  }

  it('matches when focus is within reference', async () => {
    const spy = vi.fn();
    render(() => <App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('matches when focus is within floating', async () => {
    const spy = vi.fn();
    render(() => <App1 onMatch={spy} list={['one', 'two', 'three']} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('t');
    const option = await screen.findByRole('option', { selected: true });
    expect(option.textContent).toBe('two');
    act(() => option.focus());
    expect(option).toHaveFocus();

    await userEvent.keyboard('h');
    expect((await screen.findByRole('option', { selected: true })).textContent).toBe('three');
  });

  it('onTyping is called with typing activity', async () => {
    const spy = vi.fn();
    render(() => <Combobox onTyping={spy} list={['one', 'two', 'three']} />);

    act(() => screen.getByRole('combobox').focus());

    await userEvent.keyboard('t');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(true);

    act(() => vi.advanceTimersByTime(750));
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith(false);
  });

  it('skips hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    render(() => <ComboboxWithElementsRef onMatch={spy} hiddenIndices={[0]} />);

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });

  it('does not let hidden double-letter items block rapid cycling with elementsRef', async () => {
    const spy = vi.fn();
    render(() => (
      <ComboboxWithElementsRef
        onMatch={spy}
        list={['aaron', 'apple', 'avocado']}
        hiddenIndices={[0]}
      />
    ));

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(1);

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it('skips visibility:hidden items when matching with elementsRef', async () => {
    const spy = vi.fn();
    render(() => <ComboboxWithElementsRef onMatch={spy} />);

    const apple = screen.getByRole('option', { name: 'apple' });

    apple.style.visibility = 'hidden';

    await userEvent.click(screen.getByRole('combobox'));

    await userEvent.keyboard('a');
    expect(spy).toHaveBeenCalledWith(1);
  });
});
