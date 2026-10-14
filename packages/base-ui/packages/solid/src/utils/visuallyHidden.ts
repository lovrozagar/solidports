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
  position: 'fixed',
  margin: 0,
  top: 0,
  left: 0,
};

export const visuallyHiddenInput: JSX.CSSProperties = {
  ...visuallyHiddenBase,
  position: 'absolute',
};
