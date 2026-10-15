// The Solid docs app: Next's app router (`./routes`) on the Solid router. The root layouts render
// the document, so the app renders the matched route as it is.
import { createRouter, intentPreload } from '@solidjs/router';
import { routes } from './routes';

// Next prefetches a link's route before it is clicked; here a link loads its page's module on
// hover, focus or touch (`next/link`'s `prefetch={false}` opts out).
const Router = createRouter({ routes, preloadLinks: intentPreload() });

export default function App() {
  return <Router>{(props) => props.children}</Router>;
}
