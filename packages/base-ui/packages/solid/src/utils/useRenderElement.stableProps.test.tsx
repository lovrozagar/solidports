/*
 * A part's props are built once: a state change updates the affected attribute without re-reading
 * the part's `props` (which would rebuild its whole props chain and re-run its prop getters).
 */
import { createSignal, flush } from 'solid-js';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@solidjs/testing-library';
import { Accordion } from '@solidports/base-ui/accordion';
import { Checkbox } from '@solidports/base-ui/checkbox';
import { CheckboxGroup } from '@solidports/base-ui/checkbox-group';
import { Collapsible } from '@solidports/base-ui/collapsible';
import { Slider } from '@solidports/base-ui/slider';
import { Avatar } from '@solidports/base-ui/avatar';
import { Switch } from '@solidports/base-ui/switch';
import { createRenderer } from '#test-utils';
import { mergePropsCalls, propsReads } from '../../test/propsReads';

vi.mock('./useRenderElement', async (importOriginal) =>
  (await import('../../test/propsReads')).countPropsReads(
    await importOriginal<typeof import('./useRenderElement')>(),
  ),
);

vi.mock('./native/consumer', async (importOriginal) =>
  (await import('../../test/propsReads')).countNativeReads(
    await importOriginal<typeof import('./native/consumer')>(),
  ),
);

vi.mock('../merge-props', async (importOriginal) =>
  (await import('../../test/propsReads')).countMergeProps(
    await importOriginal<typeof import('../merge-props')>(),
  ),
);

/** `mergeProps` calls (merged hidden-input props rebuilt) caused by `change`. */
function mergesDuring(change: () => void) {
  flush();
  const before = mergePropsCalls.count;
  change();
  flush();
  return mergePropsCalls.count - before;
}

/** `props` reads of the part `testId` caused by `change`. */
function readsDuring(testId: string, change: () => void) {
  flush();
  const before = propsReads.get(testId) ?? 0;
  expect(before).toBeGreaterThan(0);
  change();
  flush();
  return (propsReads.get(testId) ?? 0) - before;
}

describe('stable part props', () => {
  const { render } = createRenderer();

  it('Checkbox.Root: a controlled checked change does not rebuild its props', () => {
    const [checked, setChecked] = createSignal(false);
    render(() => <Checkbox.Root data-testid="checkbox" checked={checked()} />);

    expect(readsDuring('checkbox', () => setChecked(true))).toBe(0);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('Checkbox.Root: a click does not rebuild its props', () => {
    render(() => <Checkbox.Root data-testid="checkbox" />);

    expect(readsDuring('checkbox', () => fireEvent.click(screen.getByTestId('checkbox')))).toBe(0);
    expect(screen.getByTestId('checkbox')).toHaveAttribute('aria-checked', 'true');
  });

  it('Switch.Root: a controlled checked change does not rebuild its props', () => {
    const [checked, setChecked] = createSignal(false);
    render(() => <Switch.Root data-testid="switch" checked={checked()} />);

    expect(readsDuring('switch', () => setChecked(true))).toBe(0);
    expect(screen.getByTestId('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('Collapsible.Panel: opening does not rebuild its props', () => {
    const [open, setOpen] = createSignal(false);
    render(() => (
      <Collapsible.Root open={open()}>
        <Collapsible.Panel data-testid="panel" keepMounted>
          Content
        </Collapsible.Panel>
      </Collapsible.Root>
    ));

    expect(readsDuring('panel', () => setOpen(true))).toBe(0);
    expect(screen.getByTestId('panel')).not.toHaveAttribute('hidden');
  });

  it('Accordion.Panel: opening does not rebuild its props', () => {
    const [value, setValue] = createSignal<number[]>([]);
    render(() => (
      <Accordion.Root value={value()}>
        <Accordion.Item value={0}>
          <Accordion.Header>
            <Accordion.Trigger>Trigger</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel data-testid="panel" keepMounted>
            Content
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ));

    expect(readsDuring('panel', () => setValue([0]))).toBe(0);
    expect(screen.getByTestId('panel')).not.toHaveAttribute('hidden');
  });

  it('CheckboxGroup: a value change does not rebuild its props', () => {
    const [value, setValue] = createSignal<string[]>([]);
    render(() => (
      <CheckboxGroup data-testid="group" value={value()}>
        <Checkbox.Root value="a" data-testid="a" />
      </CheckboxGroup>
    ));

    expect(readsDuring('group', () => setValue(['a']))).toBe(0);
    expect(screen.getByTestId('a')).toHaveAttribute('aria-checked', 'true');
  });

  it('Checkbox.Root: a checked change does not rebuild its hidden input props', () => {
    const [checked, setChecked] = createSignal(false);
    render(() => <Checkbox.Root checked={checked()} />);

    expect(mergesDuring(() => setChecked(true))).toBe(0);
    expect(document.querySelector('input[type="checkbox"]')).toHaveProperty('checked', true);
  });

  it('Switch.Root: a checked change does not rebuild its hidden input props', () => {
    const [checked, setChecked] = createSignal(false);
    render(() => <Switch.Root checked={checked()} />);

    expect(mergesDuring(() => setChecked(true))).toBe(0);
    expect(document.querySelector('input[type="checkbox"]')).toHaveProperty('checked', true);
  });

  it('Slider.Thumb: a value change does not rebuild its hidden input props', () => {
    const [value, setValue] = createSignal(10);
    render(() => (
      <Slider.Root value={value()}>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ));

    expect(mergesDuring(() => setValue(20))).toBe(0);
    expect(document.querySelector('input[type="range"]')).toHaveAttribute('aria-valuenow', '20');
  });

  it('Avatar.Image: a loading status change does not rebuild its props', () => {
    render(() => (
      <Avatar.Root>
        <Avatar.Image
          data-testid="image"
          keepMounted
          src="data:image/gif;base64,R0lGODlhAQABAAAAACw="
        />
      </Avatar.Root>
    ));
    const image = screen.getByTestId('image');

    expect(readsDuring('image', () => fireEvent.load(image))).toBe(0);
  });
});
