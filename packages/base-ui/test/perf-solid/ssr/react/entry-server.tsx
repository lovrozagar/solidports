import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { ssrFixtures } from './fixtures';

export const keys = Object.keys(ssrFixtures);

export function render(key: string): string {
  const Fixture = ssrFixtures[key];
  return renderToString(<Fixture />);
}

export const head = () => '';
