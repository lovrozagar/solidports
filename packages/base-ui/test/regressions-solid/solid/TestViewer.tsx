// A port of the upstream `test/regressions/TestViewer.tsx`: the same global styles and the same
// `[data-testid="testcase"]` element, busy until the fonts have loaded.
import { createSignal, onCleanup, type ParentProps } from 'solid-js';

const globalStyles = `
  html {
    --webkit-font-smoothing: antialiased;
    --moz-osx-font-smoothing: grayscale;
    /* Do the opposite of the docs in order to help catching issues. */
    box-sizing: content-box;
  }

  *, *::before, *::after {
    box-sizing: inherit;
    /* Disable transitions to avoid flaky screenshots */
    transition: none !important;
    animation: none !important;
  }

  body {
    margin: 0;
    overflow-x: hidden;
  }
`;

export default function TestViewer(props: ParentProps) {
  const [ready, setReady] = createSignal(document.fonts.status === 'loaded');

  function handleFontsEvent(event: Event) {
    if (event.type === 'loading') {
      setReady(false);
    } else if (event.type === 'loadingdone' && document.fonts.status === 'loaded') {
      setReady(true);
    }
  }

  document.fonts.addEventListener('loading', handleFontsEvent);
  document.fonts.addEventListener('loadingdone', handleFontsEvent);
  onCleanup(() => {
    document.fonts.removeEventListener('loading', handleFontsEvent);
    document.fonts.removeEventListener('loadingdone', handleFontsEvent);
  });

  return (
    <>
      <style>{globalStyles}</style>
      <div aria-busy={!ready()} data-testid="testcase" style={{ display: 'block', padding: '8px' }}>
        {props.children}
      </div>
    </>
  );
}
