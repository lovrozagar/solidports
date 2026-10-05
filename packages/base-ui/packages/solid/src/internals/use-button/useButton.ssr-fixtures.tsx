import type { JSX } from '@solidjs/web';
import { defineSsrFixtures } from '../../../test/defineSsrFixtures';
import { splitProps } from '../../solid-1-compat';
import { useButton } from './useButton';

function NonNativeButton(props: JSX.HTMLAttributes<HTMLSpanElement> & { disabled?: boolean }) {
  const [local, otherProps] = splitProps(props, ['disabled']);
  const { getButtonProps } = useButton({ disabled: () => local.disabled, native: false });

  return <span {...getButtonProps(otherProps)} />;
}

function NativeButton(props: JSX.ButtonHTMLAttributes<HTMLButtonElement>) {
  const [local, otherProps] = splitProps(props, ['disabled']);
  const { getButtonProps } = useButton({ disabled: () => local.disabled });

  return <button {...getButtonProps(otherProps)} />;
}

export default defineSsrFixtures(import.meta.url, {
  nonNativeDisabled: () => <NonNativeButton disabled />,
  nativeDisabled: () => <NativeButton disabled>Submit</NativeButton>,
});
