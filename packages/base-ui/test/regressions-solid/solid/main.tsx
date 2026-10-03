// The Solid counterpart of the upstream regressions host (`test/regressions/main.tsx`): the
// generated Solid docs demos at the React demos' routes, each rendered into `#test-viewer` inside
// `TestViewer`, with the same `#tests` navigation the upstream screenshot spec clicks through.
import { For, onCleanup, type Component } from 'solid-js';
import { render } from '@solidjs/web';
import { createRouter } from '@solidjs/router';
import TestViewer from './TestViewer';
import '../../../docs/solid/src/css/index.css';

declare const __REGRESSION_ROUTES__: Record<string, string>;

interface Fixture {
  Component: Component;
  path: string;
}

const demos = import.meta.glob<{ default?: Component }>(
  '../../../docs/solid/src/demos/solid/**/index.tsx',
  { eager: true },
);

const fixtures: Fixture[] = [];
for (const file in demos) {
  const dir = file.replace(/^.*\/demos\/solid\//, '').replace(/\/index\.tsx$/, '');
  const route = __REGRESSION_ROUTES__[dir];
  const DemoComponent = demos[file].default;
  // Solid-only demos have no React counterpart to compare with.
  if (route && DemoComponent) {
    fixtures.push({ Component: DemoComponent, path: route });
  }
}
fixtures.sort((a, b) => a.path.localeCompare(b.path));

const viewerRoot = document.getElementById('test-viewer')!;

// One root in `#test-viewer`, as upstream renders every fixture through one React root: the next
// fixture replaces the current one after its route commits (disposing a root clears the element).
let disposeCurrent: (() => void) | undefined;

function FixtureRenderer(props: { component: Component }) {
  const timeout = setTimeout(() => {
    const Demo = props.component;
    disposeCurrent?.();
    disposeCurrent = render(
      () => (
        <TestViewer>
          <Demo />
        </TestViewer>
      ),
      viewerRoot,
    );
  });
  onCleanup(() => clearTimeout(timeout));
  return null;
}

function isDev() {
  if (window.location.hash === '#dev') {
    return true;
  }
  if (window.location.hash === '#no-dev') {
    return false;
  }
  return import.meta.env.DEV;
}

function Nav() {
  return (
    <div hidden={!isDev()}>
      <details>
        <summary id="my-test-summary">nav for all tests</summary>
        <nav id="tests">
          <ol>
            <For each={fixtures}>
              {(fixture) => (
                <li>
                  <a href={fixture.path}>{fixture.path}</a>
                </li>
              )}
            </For>
          </ol>
        </nav>
      </details>
    </div>
  );
}

// Plain anchors are router links (the router delegates them), as React Router's `<Link>` upstream.
const Router = createRouter({
  routes: fixtures.map((fixture) => ({
    path: fixture.path,
    component: () => <FixtureRenderer component={fixture.Component} />,
  })),
});

render(
  () => (
    <Router>
      {(props) => (
        <>
          {props.children}
          <Nav />
        </>
      )}
    </Router>
  ),
  document.getElementById('react-root')!,
);
