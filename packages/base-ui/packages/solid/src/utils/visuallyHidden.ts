import type { JSX } from '@solidjs/web';

const visuallyHiddenBase: JSX.CSSProperties = {
  border: 0,
  'clip-path': 'inset(50%)',
  height: '1px',
  margin: '-1px',
  overflow: 'hidden',
  padding: 0,
  'white-space': 'nowrap',
  width: '1px',
};

export const visuallyHidden: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  left: 0,
  position: 'fixed',
  top: 0,
};

export const visuallyHiddenInput: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'absolute',
};
