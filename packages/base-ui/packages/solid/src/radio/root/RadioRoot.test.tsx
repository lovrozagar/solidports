import { createRenderer, describeConformance, act } from '#test-utils';
import { Radio } from '@solidports/base-ui/radio';
import { Field } from '@solidports/base-ui/field';
import { RadioGroup } from '@solidports/base-ui/radio-group';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';

describe('<Radio.Root />', () => {
  const { render } = createRenderer();

  describeConformance(
    (props: any) => <Radio.Root {...props} ref={props.ref} value="" />,
    () => ({
      refInstanceof: window.HTMLSpanElement,
      testComponentPropWith: 'span',
      button: true,
      render,
    }),
  );

  it('sets checked and unchecked data attributes', async () => {
    render(() => (
      <RadioGroup defaultValue="checked">
        <Radio.Root value="checked" data-testid="checked" />
        <Radio.Root value="unchecked" data-testid="unchecked" />
      </RadioGroup>
    ));

    expect(screen.getByTestId('checked')).toHaveAttribute('data-checked');
    expect(screen.getByTestId('checked')).not.toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).toHaveAttribute('data-unchecked');
    expect(screen.getByTestId('unchecked')).not.toHaveAttribute('data-checked');
  });

  it('does not forward `value` prop', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value="test" data-testid="radio-root" />
      </RadioGroup>
    ));

    expect(screen.getByTestId('radio-root')).not.toHaveAttribute('value');
  });

  it('allows `null` value', async () => {
    render(() => (
      <RadioGroup>
        <Radio.Root value={null} data-testid="radio-null" />
        <Radio.Root value="a" data-testid="radio-a" />
      </RadioGroup>
    ));

    const radioNull = screen.getByTestId('radio-null');
    const radioA = screen.getByTestId('radio-a');
    fireEvent.click(radioNull);
    expect(radioNull).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(radioA);
    expect(radioNull).toHaveAttribute('aria-checked', 'false');
  });

  it('associates `id` with the native button when `nativeButton=true`', async () => {
    render(() => (
      <div>
        <label data-testid="label" for="myRadio">
          A
        </label>

        <RadioGroup defaultValue="b">
          <Radio.Root value="a" id="myRadio" nativeButton render="button" data-testid="a" />
          <Radio.Root value="b" data-testid="b" />
        </RadioGroup>
      </div>
    ));

    const radioA = screen.getByTestId('a');
    expect(radioA).toHaveAttribute('id', 'myRadio');

    const hiddenInput = radioA.nextElementSibling as HTMLInputElement | null;
    expect(hiddenInput?.tagName).toBe('INPUT');
    expect(hiddenInput).not.toHaveAttribute('id', 'myRadio');

    expect(radioA).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(screen.getByTestId('label'));
    expect(radioA).toHaveAttribute('aria-checked', 'true');
  });

  it('sets `aria-labelledby` from a sibling label associated with the hidden input', async () => {
    render(() => (
      <div>
        <label for="radio-input">Label</label>
        <RadioGroup>
          <Radio.Root value="a" id="radio-input" />
        </RadioGroup>
      </div>
    ));

    const label = screen.getByText('Label');
    expect(label.id).not.toBe('');
    expect(screen.getByRole('radio')).toHaveAttribute('aria-labelledby', label.id);
  });

  it('updates fallback `aria-labelledby` when the hidden input id changes', async () => {
    function TestCase() {
      const [id, setId] = createSignal('radio-input-a');

      return (
        <>
          <label for="radio-input-a">Label A</label>
          <label for="radio-input-b">Label B</label>
          <RadioGroup>
            <Radio.Root value="a" id={id()} />
          </RadioGroup>
          <button type="button" onClick={() => setId('radio-input-b')}>
            Toggle
          </button>
        </>
      );
    }

    render(() => <TestCase />);

    const radio = screen.getByRole('radio');
    const labelA = screen.getByText('Label A');

    expect(labelA.id).not.toBe('');
    expect(radio).toHaveAttribute('aria-labelledby', labelA.id);

    fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));

    const labelB = screen.getByText('Label B');

    await waitFor(() => {
      expect(radio).toHaveAttribute('aria-labelledby', labelB.id);
    });
    expect(labelB.id).not.toBe('');
    expect(labelB.id).not.toBe(labelA.id);
  });

  it('prefers `aria-label` over an associated label', async () => {
    render(() => (
      <RadioGroup>
        <label>
          <Radio.Root value="a" aria-label="Apple" />
          Apple
        </label>
        <span id="explicit-radio">Explicit radio</span>
        <Radio.Root value="b" aria-label="ignored" aria-labelledby="explicit-radio" />
      </RadioGroup>
    ));

    const [radio, explicitRadio] = screen.getAllByRole('radio');
    expect(radio).not.toHaveAttribute('aria-labelledby');
    expect(radio).toHaveAccessibleName('Apple');
    expect(explicitRadio).toHaveAttribute('aria-labelledby', 'explicit-radio');
    expect(explicitRadio).toHaveAccessibleName('Explicit radio');
  });

  describe('prop: onClick', () => {
    it('does not propagate a click to ancestors when selecting with arrow keys', async () => {
      const handleParentClick = vi.fn();
      const { user } = render(() => (
        <div onClick={handleParentClick}>
          <RadioGroup defaultValue="a">
            <Radio.Root value="a" data-testid="radio-a" />
            <Radio.Root value="b" data-testid="radio-b" />
          </RadioGroup>
        </div>
      ));

      await user.click(screen.getByTestId('radio-a'));
      handleParentClick.mockClear();

      await user.keyboard('{ArrowDown}');

      expect(screen.getByTestId('radio-b')).toHaveAttribute('aria-checked', 'true');
      expect(handleParentClick).toHaveBeenCalledTimes(0);
    });

    it.each([false, true])(
      'propagates a single click event to ancestors per user click (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(() => (
          <RadioGroup>
            <div onClick={handleParentClick}>
              <Radio.Root
                value="a"
                nativeButton={nativeButton}
                render={nativeButton ? 'button' : undefined}
                data-testid="radio"
              />
            </div>
          </RadioGroup>
        ));

        fireEvent.click(screen.getByTestId('radio'));

        expect(handleParentClick).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      },
    );

    it.each([false, true])(
      'does not propagate to ancestors when stopPropagation() is called (nativeButton=%s)',
      async (nativeButton) => {
        const handleParentClick = vi.fn();
        await render(() => (
          <RadioGroup>
            <div onClick={handleParentClick}>
              <Radio.Root
                value="a"
                nativeButton={nativeButton}
                render={nativeButton ? 'button' : undefined}
                data-testid="radio"
                onClick={(event) => event.stopPropagation()}
              />
            </div>
          </RadioGroup>
        ));

        fireEvent.click(screen.getByTestId('radio'));

        expect(handleParentClick).toHaveBeenCalledTimes(0);
        expect(screen.getByTestId('radio')).toHaveAttribute('aria-checked', 'true');
      },
    );
  });

  describe('prop: disabled', () => {
    it('uses aria-disabled instead of HTML disabled', async () => {
      render(() => (
        <RadioGroup>
          <Radio.Root value="a" disabled data-testid="radio" />
        </RadioGroup>
      ));

      const radio = screen.getByTestId('radio');
      expect(radio).not.toHaveAttribute('disabled');
      expect(radio).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not acquire the field focused state when focused programmatically', async () => {
      await render(() => (
        <Field.Root data-testid="field">
          <Radio.Root value="a" disabled data-testid="radio" />
        </Field.Root>
      ));

      const radio = screen.getByTestId('radio');

      act(() => {
        radio.focus();
      });

      expect(radio).toHaveFocus();
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-focused');
    });
  });

  describe('prop: readOnly', () => {
    it('acquires the field focused state on focus', async () => {
      await render(() => (
        <Field.Root data-testid="field">
          <Radio.Root value="a" readOnly data-testid="radio" />
        </Field.Root>
      ));

      act(() => {
        screen.getByTestId('radio').focus();
      });

      expect(screen.getByTestId('field')).toHaveAttribute('data-focused', '');
    });
  });
});
