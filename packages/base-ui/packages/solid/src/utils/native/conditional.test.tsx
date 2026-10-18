import { createContext, createSignal, flush, getOwner, onCleanup, useContext } from 'solid-js';
import type { Owner } from 'solid-js';
import type { JSX } from '@solidjs/web';
import { describe, expect, it } from 'vitest';
import { screen } from '@solidjs/testing-library';
import { createRenderer } from '#test-utils';
import { NativeConditional } from './conditional';

const Value = createContext('outside');

/** A part as a class: its inputs are fields, its condition and branch are methods. */
class Part extends NativeConditional<JSX.Element> {
  declare private readonly open: () => boolean;
  declare readonly log: string[];

  constructor(open: () => boolean, owner: Owner | null) {
    super(owner);
    this.open = open;
    this.log = [];
  }

  shouldRender() {
    return this.open();
  }

  render() {
    const log = this.log;
    const value = useContext(Value);
    log.push(`render ${value}`);
    onCleanup(() => log.push('dispose'));
    return <span data-testid="branch">{value}</span>;
  }
}

describe('NativeConditional', () => {
  const { render } = createRenderer();

  it('renders the branch while the condition holds, in a root the part owns', () => {
    const [open, setOpen] = createSignal(false);
    let part!: Part;
    render(() => (
      <Value value="inside">
        {(() => {
          part = new Part(open, getOwner());
          return part.accessor() as unknown as JSX.Element;
        })()}
      </Value>
    ));
    expect(screen.queryByTestId('branch')).toBe(null);
    setOpen(true);
    flush();
    expect(screen.getByTestId('branch')).toHaveTextContent('inside');
    setOpen(false);
    flush();
    expect(screen.queryByTestId('branch')).toBe(null);
    setOpen(true);
    flush();
    expect(part.log).toEqual(['render inside', 'dispose', 'render inside']);
  });
});
