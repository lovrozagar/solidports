import * as React from 'react';
import { renderToString } from 'react-dom/server';
import { COMPONENTS, SCENARIO_TAGS } from '../../shared/manifest';
import { ssrCases } from '../cases';
import { ssrFixtures } from './fixtures/index';

export const keys = Object.keys(ssrFixtures);

/** The shared case list, so the runner filters and checks registrations from the bundle. */
export const cases = ssrCases;

/** The manifest vocabularies, so the runner validates its filter. */
export const vocab = { components: COMPONENTS, tags: SCENARIO_TAGS };

export function render(key: string): string {
  const Fixture = ssrFixtures[key];
  return renderToString(<Fixture />);
}

export const head = () => '';
