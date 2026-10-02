import { createRenderer, describeConformance } from '#test-utils';
import { Field } from '@solidports/base-ui/field';
import { screen } from '@solidjs/testing-library';
import { expect } from 'vitest';

describe('<Field.Description />', () => {
  const { render } = createRenderer();

  describeConformance(Field.Description, () => ({
    refInstanceof: window.HTMLParagraphElement,
    render: (node, props) => render(() => <Field.Root>{node(props!)}</Field.Root>),
  }));

  it('should set aria-describedby on the control automatically', () => {
    render(() => (
      <Field.Root>
        <Field.Control />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).to.have.attribute(
      'aria-describedby',
      screen.getByText('Message').id,
    );
  });

  it('should preserve user aria-describedby values on the control', () => {
    render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description>Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox').getAttribute('aria-describedby')).to.equal(
      `external-description ${screen.getByText('Message').id}`,
    );
  });

  it('does not register an empty description id', () => {
    render(() => (
      <Field.Root>
        <Field.Control aria-describedby="external-description" />
        <Field.Description id="">Message</Field.Description>
      </Field.Root>
    ));

    expect(screen.getByRole('textbox')).to.have.attribute(
      'aria-describedby',
      'external-description',
    );
  });

  it('reflects the disabled state from Field.Item', () => {
    render(() => (
      <Field.Root>
        <Field.Item disabled>
          <Field.Description data-testid="description">Message</Field.Description>
        </Field.Item>
      </Field.Root>
    ));

    expect(screen.getByTestId('description')).to.have.attribute('data-disabled');
  });
});
