import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { ssrCases } from '../cases';
import { ssrFixtures } from './fixtures/index';

export const keys = Object.keys(ssrFixtures);

/** The shared case list, so the runner filters and checks registrations from the bundle. */
export const cases = ssrCases;

export function render(key: string): string {
  const Fixture = ssrFixtures[key];
  return renderToString(<Fixture />);
}

export const head = () => '';
