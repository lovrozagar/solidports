import type { Component } from 'solid-js';
import { mdxComponents } from 'docs/src/mdx-components';
import precompute from '../__fixtures__/code-block.json';
import { createPageFixture } from '../__fixtures__/router';

const Pre = mdxComponents.pre as Component<Record<string, unknown>>;
const data = JSON.stringify(precompute);

/** Two code blocks as an MDX page renders them: highlighted from the start, and once idle. */
export const CodeBlocksFixture = createPageFixture('/solid/overview/quick-start', () => (
  <div>
    <div class="init">
      <Pre
        data-precompute={data}
        data-content-props={JSON.stringify({ title: 'index.css' })}
        data-highlight-after="init"
        data-enhance-after="init"
      />
    </div>
    <div class="idle">
      <Pre data-precompute={data} />
    </div>
  </div>
));
