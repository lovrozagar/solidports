// The Solid docs app: Next's app router (`./routes`) on the Solid router. The root layouts render
// the document, so the app renders the matched route as it is.
import { createRouter } from '@solidjs/router';
import { routes } from './routes';

const Router = createRouter({ routes });

export default function App() {
  return <Router>{(props) => props.children}</Router>;
}
