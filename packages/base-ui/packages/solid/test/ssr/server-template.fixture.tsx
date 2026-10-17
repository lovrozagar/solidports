import { renderToString } from '@solidjs/web';
import { renderNativeElement } from '../../src/utils/native/element';

/** One native element's inputs, by position: `server-template.test.ts` renders it on both paths. */
export interface Row {
  tag?: string;
  /** The template's own attributes. */
  template?: Record<string, unknown>;
  /** The consumer's props: static values, and `reactive` ones read through getters. */
  consumer?: Record<string, unknown>;
  reactive?: Record<string, unknown>;
  /** The part's literal attributes and its attribute writes, in order. */
  literal?: Record<string, unknown>;
  writes?: Array<[string, unknown]>;
  partStyle?: Record<string, unknown>;
  styleOverride?: Record<string, unknown>;
  children?: unknown;
}

const OWN: ReadonlySet<string> = new Set();

/** The row's element, server-rendered. */
export function markupOf(row: Row) {
  const tag = row.tag ?? 'div';
  const props: Record<string, unknown> = { ...row.consumer };
  for (const [key, value] of Object.entries(row.reactive ?? {})) {
    Object.defineProperty(props, key, { enumerable: true, get: () => value });
  }
  if ('children' in row) {
    props.children = row.children;
  }
  const template = {
    tag,
    attributes: row.template,
    create: () => {
      throw new Error('server only');
    },
  };
  return renderToString(
    () =>
      renderNativeElement(template, props, {
        own: OWN,
        reactive: true,
        literal: row.literal,
        attributes: row.writes
          ? (set) => {
              for (const [key, value] of row.writes!) {
                set(key, value);
              }
            }
          : undefined,
        partStyle: row.partStyle ? () => row.partStyle as never : undefined,
        styleOverride: row.styleOverride ? () => row.styleOverride as never : undefined,
      }) as never,
  );
}
