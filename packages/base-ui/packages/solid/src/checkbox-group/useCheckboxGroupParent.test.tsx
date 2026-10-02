import { act, createRenderer } from '#test-utils';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { fireEvent, screen } from '@solidjs/testing-library';
import { expect } from 'vitest';
import { spy } from 'sinon';
import { createSignal, For, Show } from 'solid-js';

describe('useCheckboxGroupParent', () => {
  const { render } = createRenderer();
  const allValues = ['a', 'b', 'c'];

  it('should control child checkboxes', () => {
    const parentCheckedChange = spy();
    const childCheckedChange = spy();
    function App() {
      const [value, setValue] = createSignal<string[]>([]);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" onCheckedChange={parentCheckedChange} />
          <Checkbox.Root value="a" />
          <Checkbox.Root value="b" onCheckedChange={childCheckedChange} />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);
    const parent = screen.getByTestId('parent');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    fireEvent.click(parent);
    expect(parent).to.have.attribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    expect(parentCheckedChange.callCount).to.equal(1);
    expect(childCheckedChange.callCount).to.equal(0);

    fireEvent.click(parent);
    expect(parent).to.have.attribute('aria-checked', 'false');

    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    expect(parentCheckedChange.callCount).to.equal(2);
    expect(childCheckedChange.callCount).to.equal(0);
  });

  it('parent should be marked as mixed if some children are checked', () => {
    const childCheckedChange = spy();
    function App() {
      const [value, setValue] = createSignal<string[]>([]);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" onCheckedChange={childCheckedChange} />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });
    fireEvent.click(checkboxes[0]);
    expect(childCheckedChange.callCount).to.equal(1);

    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'mixed');
  });

  it('updates uncontrolled parent-enabled groups from child clicks without duplicate callbacks', () => {
    const handleValueChange = spy();

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');
    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const checkboxC = screen.getByTestId('checkboxC');

    fireEvent.click(checkboxA);

    expect(handleValueChange.callCount).to.equal(1);
    expect(handleValueChange.getCall(0).args[0]).to.deep.equal(['a']);
    expect(parent).to.have.attribute('aria-checked', 'mixed');
    expect(checkboxA).to.have.attribute('aria-checked', 'true');
    expect(checkboxB).to.have.attribute('aria-checked', 'false');

    fireEvent.click(parent);

    expect(handleValueChange.callCount).to.equal(2);
    expect(handleValueChange.getCall(1).args[0]).to.deep.equal(['a', 'b', 'c']);
    expect(parent).to.have.attribute('aria-checked', 'true');
    expect(checkboxA).to.have.attribute('aria-checked', 'true');
    expect(checkboxB).to.have.attribute('aria-checked', 'true');
    expect(checkboxC).to.have.attribute('aria-checked', 'true');

    fireEvent.click(parent);

    expect(handleValueChange.callCount).to.equal(3);
    expect(handleValueChange.getCall(2).args[0]).to.deep.equal([]);
    expect(parent).to.have.attribute('aria-checked', 'false');
    expect(checkboxA).to.have.attribute('aria-checked', 'false');
    expect(checkboxB).to.have.attribute('aria-checked', 'false');
    expect(checkboxC).to.have.attribute('aria-checked', 'false');
  });

  it('should correctly initialize the values array', () => {
    function App() {
      const [value, setValue] = createSignal<string[]>(['a']);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'mixed');

    expect(screen.getByTestId('checkboxA')).to.have.attribute('aria-checked', 'true');
  });

  it('should update the values array when a child checkbox is clicked', () => {
    function App() {
      const [value, setValue] = createSignal<string[]>(['a']);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'mixed');

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);

    const checkboxA = screen.getByTestId('checkboxA');
    expect(checkboxA).to.have.attribute('aria-checked', 'true');

    checkboxes.forEach((checkbox) => {
      if (checkbox !== checkboxA) {
        fireEvent.click(checkbox);
      }
    });

    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'true');
  });

  it('should apply space-separated aria-controls attribute with child names', () => {
    function App() {
      const [value, setValue] = createSignal<string[]>([]);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <For each={allValues}>{(v) => <Checkbox.Root value={v} data-testid={v} />}</For>
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    expect(screen.getByTestId('parent')).to.have.attribute(
      'aria-controls',
      allValues.map((v) => screen.getByTestId(v).id).join(' '),
    );
  });

  it('keeps a custom child id in aria-controls', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" nativeButton render={'button'} />
        <Checkbox.Root id="custom" value="a" data-testid="a" nativeButton render={'button'} />
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('a')).to.have.attribute('id', 'custom');
    expect(screen.getByTestId('parent')).to.have.attribute('aria-controls', 'custom');
  });

  it.each([false, true])(
    'keeps a rendered child id in aria-controls (nativeButton=%s)',
    (nativeButton) => {
      render(() => (
        <CheckboxGroup allValues={['a']}>
          <Checkbox.Root
            parent
            data-testid="parent"
            nativeButton={nativeButton}
            render={nativeButton ? 'button' : undefined}
          />
          <Checkbox.Root
            value="a"
            nativeButton={nativeButton}
            render={(props) =>
              nativeButton ? <button {...props} id="rendered" /> : <span {...props} id="rendered" />
            }
          />
        </CheckboxGroup>
      ));

      expect(screen.getByTestId('parent')).to.have.attribute('aria-controls', 'rendered');
    },
  );

  it('references the exposed child rather than its custom-id input without nativeButton', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="custom" value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    // The custom `id` lands on the hidden input, so `aria-controls` has to name the exposed
    // element instead.
    expect(document.querySelector('input[type="checkbox"][id="custom"]')).not.to.equal(null);
    expect(screen.getByTestId('a').id).not.to.equal('custom');
    expect(screen.getByTestId('parent')).to.have.attribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('does not read aria-controls ids off Object.prototype', () => {
    render(() => (
      <CheckboxGroup allValues={['a', 'constructor']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    expect(screen.getByTestId('parent')).to.have.attribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('drops an unmounted child from aria-controls', async () => {
    const [showB, setShowB] = createSignal(true);
    function App(props: { showB: boolean }) {
      return (
        <CheckboxGroup allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="a" />
          <Show when={props.showB}>
            <Checkbox.Root value="b" data-testid="b" />
          </Show>
        </CheckboxGroup>
      );
    }

    render(() => <App showB={showB()} />);
    act(() => setShowB(false));

    expect(screen.getByTestId('parent')).to.have.attribute(
      'aria-controls',
      screen.getByTestId('a').id,
    );
  });

  it('keeps both ids for checkboxes sharing a value and retains the survivor', async () => {
    const [showSecondB, setShowSecondB] = createSignal(true);
    function App(props: { showSecondB: boolean }) {
      return (
        <CheckboxGroup allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="a" />
          <Checkbox.Root value="b" data-testid="b" />
          <Show when={props.showSecondB}>
            <Checkbox.Root value="b" data-testid="second-b" />
          </Show>
        </CheckboxGroup>
      );
    }

    render(() => <App showSecondB={showSecondB()} />);

    expect(screen.getByTestId('parent')).to.have.attribute(
      'aria-controls',
      `${screen.getByTestId('a').id} ${screen.getByTestId('b').id} ${screen.getByTestId('second-b').id}`,
    );

    act(() => setShowSecondB(false));

    expect(screen.getByTestId('parent')).to.have.attribute(
      'aria-controls',
      `${screen.getByTestId('a').id} ${screen.getByTestId('b').id}`,
    );
  });

  it('does not select a child without an identifying value', () => {
    render(() => (
      <CheckboxGroup allValues={['a']}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root id="standalone" data-testid="no-value" />
        <Checkbox.Root value="a" data-testid="checkbox-a" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');
    const noValue = screen.getByTestId('no-value');
    const checkboxA = screen.getByTestId('checkbox-a');

    fireEvent.click(parent);

    expect(parent).to.have.attribute('aria-checked', 'true');
    expect(checkboxA).to.have.attribute('aria-checked', 'true');
    expect(noValue).to.have.attribute('aria-checked', 'false');
    expect(noValue.nextElementSibling).to.have.attribute('id', 'standalone');
  });

  it('preserves initial state if mixed when parent is clicked', () => {
    function App() {
      const [value, setValue] = createSignal<string[]>([]);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((v) => v.getAttribute('data-parent') == null);
    const checkboxA = screen.getByTestId('checkboxA');
    const parent = screen.getByTestId('parent');

    fireEvent.click(checkboxA);

    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'mixed');

    fireEvent.click(parent);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', 'true');
    });

    fireEvent.click(parent);

    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', 'false');
    });

    fireEvent.click(parent);

    expect(parent).to.have.attribute('aria-checked', 'mixed');
    expect(checkboxA).to.have.attribute('aria-checked', 'true');
    checkboxes.forEach((checkbox) => {
      expect(checkbox).to.have.attribute('aria-checked', checkbox === checkboxA ? 'true' : 'false');
    });
  });

  it('lets a parent checkbox cancel a parent-enabled group change', () => {
    const handleValueChange = spy();
    const handleParentChange = spy((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" onCheckedChange={handleParentChange} />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" data-testid="checkboxB" />
        <Checkbox.Root value="c" data-testid="checkboxC" />
      </CheckboxGroup>
    ));

    fireEvent.click(screen.getByTestId('parent'));

    expect(handleParentChange.callCount).to.equal(1);
    expect(handleValueChange.callCount).to.equal(0);
    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).to.have.attribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxB')).to.have.attribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxC')).to.have.attribute('aria-checked', 'false');
  });

  it('lets a child checkbox cancel a parent-enabled group change', () => {
    const handleValueChange = spy();
    const handleChildChange = spy((_, eventDetails: Checkbox.Root.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" onCheckedChange={handleChildChange} />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    fireEvent.click(screen.getByTestId('checkboxA'));

    expect(handleChildChange.callCount).to.equal(1);
    expect(handleValueChange.callCount).to.equal(0);
    expect(screen.getByTestId('parent')).to.have.attribute('aria-checked', 'false');
    expect(screen.getByTestId('checkboxA')).to.have.attribute('aria-checked', 'false');
  });

  it('does not advance the parent toggle cycle when the group cancels a parent change', () => {
    const handleValueChange = spy((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup value={['a']} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    const parent = screen.getByTestId('parent');

    // From a mixed state the parent attempts to check all. The group cancels, so
    // the internal status must not advance to 'on'.
    fireEvent.click(parent);
    // A second click must retry the same 'mixed -> on' transition instead of
    // skipping ahead to 'on -> off' and proposing an empty value.
    fireEvent.click(parent);

    expect(handleValueChange.callCount).to.equal(2);
    expect(handleValueChange.getCall(0).args[0]).to.deep.equal(allValues);
    expect(handleValueChange.getCall(1).args[0]).to.deep.equal(allValues);
  });

  it('does not pollute the parent snapshot when the group cancels a child change', () => {
    const handleValueChange = spy((_, eventDetails: CheckboxGroup.ChangeEventDetails) => {
      eventDetails.cancel();
    });

    render(() => (
      <CheckboxGroup value={allValues} allValues={allValues} onValueChange={handleValueChange}>
        <Checkbox.Root parent data-testid="parent" />
        <Checkbox.Root value="a" data-testid="checkboxA" />
        <Checkbox.Root value="b" />
        <Checkbox.Root value="c" />
      </CheckboxGroup>
    ));

    // Unchecking a child is canceled, so the parent's snapshot of checked
    // children must stay intact.
    fireEvent.click(screen.getByTestId('checkboxA'));
    // The parent still sees an all-checked group and toggles to none. A polluted
    // snapshot would make it propose checking everything again.
    fireEvent.click(screen.getByTestId('parent'));

    expect(handleValueChange.callCount).to.equal(2);
    expect(handleValueChange.getCall(0).args[0]).to.deep.equal(['b', 'c']);
    expect(handleValueChange.getCall(1).args[0]).to.deep.equal([]);
  });

  it('handles unchecked disabled checkboxes', () => {
    function App() {
      const [value, setValue] = createSignal<string[]>([]);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" disabled data-testid="checkboxA" />
          <Checkbox.Root value="b" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    const parent = screen.getByTestId('parent');
    fireEvent.click(parent);

    expect(parent).to.have.attribute('aria-checked', 'mixed');
    expect(screen.getByTestId('checkboxA')).to.have.attribute('aria-checked', 'false');
  });

  it('handles checked disabled checkboxes', () => {
    function App() {
      const [value, setValue] = createSignal<string[]>(['a']);
      return (
        <CheckboxGroup value={value()} onValueChange={setValue} allValues={allValues}>
          <Checkbox.Root parent data-testid="parent" />
          <Checkbox.Root value="a" data-testid="checkboxA" disabled />
          <Checkbox.Root value="b" data-testid="checkboxB" />
          <Checkbox.Root value="c" />
        </CheckboxGroup>
      );
    }

    render(() => <App />);

    const checkboxA = screen.getByTestId('checkboxA');
    const checkboxB = screen.getByTestId('checkboxB');
    const parent = screen.getByTestId('parent');

    fireEvent.click(parent);
    expect(checkboxA).to.have.attribute('aria-checked', 'true');
    expect(checkboxB).to.have.attribute('aria-checked', 'true');

    fireEvent.click(parent);
    expect(checkboxA).to.have.attribute('aria-checked', 'true');
    expect(checkboxB).to.have.attribute('aria-checked', 'false');
  });
});
