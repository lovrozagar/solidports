import { createRouter } from '@solidjs/router';
import * as DomTestingLibrary from '@testing-library/dom';
import { render } from '@solidjs/web';
import { createSignal, For, onCleanup, type Component } from 'solid-js';
import TestViewer from './TestViewer';
import './styles.css';

interface Fixture {
  Component: Component;
  path: string;
}

const globbedFixtures = import.meta.glob<{ default: Component }>('./fixtures/**/*.tsx', {
  eager: true,
});

// Same URLs as the React app: `./fixtures/menu/PageOne.tsx` is served at `/e2e-fixtures/menu/PageOne`.
const fixtures: Fixture[] = Object.entries(globbedFixtures).map(([file, module]) => ({
  path: `/e2e-fixtures/${file.slice('./fixtures/'.length, -'.tsx'.length)}`,
  Component: module.default,
}));

function computeIsDev() {
  if (window.location.hash === '#dev') {
    return true;
  }
  if (window.location.hash === '#no-dev') {
    return false;
  }
  return import.meta.env.DEV;
}

function DevNav() {
  const [isDev, setDev] = createSignal(computeIsDev());
  const handleHashChange = () => setDev(computeIsDev());
  window.addEventListener('hashchange', handleHashChange);
  onCleanup(() => window.removeEventListener('hashchange', handleHashChange));

  return (
    <div hidden={!isDev()}>
      <p>
        Devtools can be enabled by appending <code>#dev</code> in the addressbar or disabled by
        appending <code>#no-dev</code>.
      </p>
      <a href="#no-dev">Hide devtools</a>
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

// Plain anchors are router links (the router delegates them), as React Router's `<Link>` in the
// React app.
const Router = createRouter({
  routes: fixtures.map((fixture) => {
    const FixtureComponent = fixture.Component;
    return {
      path: fixture.path,
      component: () => (
        <TestViewer>
          <FixtureComponent />
        </TestViewer>
      ),
    };
  }),
});

function App() {
  return (
    <Router>
      {(props) => (
        <>
          {props.children}
          <DevNav />
        </>
      )}
    </Router>
  );
}

render(() => <App />, document.getElementById('root')!);

declare global {
  interface Window {
    DomTestingLibrary: typeof DomTestingLibrary;
    elementToString: (element: Node | null | undefined) => string | undefined;
  }
}

// Used by the Playwright matchers, as in the React app.
window.DomTestingLibrary = DomTestingLibrary;
window.elementToString = function elementToString(element) {
  if (
    element != null &&
    (element.nodeType === element.ELEMENT_NODE || element.nodeType === element.DOCUMENT_NODE)
  ) {
    return window.DomTestingLibrary.prettyDOM(element as Element, undefined, {
      highlight: true,
      maxDepth: 1,
    }) as string;
  }
  return String(element);
};
