import type { ParentProps } from 'solid-js'
import { Link } from '../components/Link'
import { Logo } from '../components/Logo'
import { Search } from '../components/Search'
import './css/index.css'

export function HomeLayout(props: ParentProps) {
  return (
    <div class="Body bui-p-6 bp2:bui-py-7 bp2:bui-px-9" style={{ 'min-height': '100vh' }}>
      <div
        class="bui-bs-bb bui-d-g bui-gtc-8 bui-g-8 bp2:bui-g-9"
        style={{ 'max-width': '1480px', 'margin-inline': 'auto' }}
      >
        <header class="bui-d-c">
          <div class="bui-gcs-1 bui-gce-4">
            <Logo aria-label="Base UI" />
          </div>
          <nav
            class="bui-d-f bui-fd-c bui-g-2 bui-gcs-5 bui-gce-8 bp2:bui-gcs-5 bp2:bui-gce-9 bp3:bui-gcs-5 bp3:bui-gce-7"
            aria-label="social links"
          >
            <Link class="Text sz-1" href="https://x.com/base_ui">
              X
            </Link>
            <Link class="Text sz-1" href="https://github.com/mui/base-ui">
              GitHub
            </Link>
            <Link class="Text sz-1" href="https://base-ui.com/r/discord">
              Discord
            </Link>
          </nav>
          <div class="bui-d-n bp3:bui-d-f bui-fd-c bui-g-2 bui-ai-s bui-gcs-7 bui-gce-9">
            <Search enableKeyboardShortcut mobileTriggerClass="bui-d-n" />
          </div>
        </header>
        <main id="main" class="bui-d-c">
          {props.children}
        </main>
        <div class="bui-gcs-1 bui-gce-9 bp3:bui-gcs-3">
          <div class="Separator" role="separator" aria-hidden="true" />
        </div>
        <footer class="bui-d-c">
          <div class="bui-gcs-1 bui-gce-9 bp2:bui-gce-3">
            <span class="Text sz-1">© Base UI</span>
          </div>
          <nav
            class="bui-d-f bui-fd-c bui-g-2 bui-gcs-1 bui-gce-9 bp2:bui-gcs-3 bp4:bui-gce-7"
            aria-label="social links"
          >
            <Link class="Text sz-1" href="https://x.com/base_ui">
              X
            </Link>
            <Link class="Text sz-1" href="https://github.com/mui/base-ui">
              GitHub
            </Link>
            <Link class="Text sz-1" href="https://base-ui.com/r/discord">
              Discord
            </Link>
            <Link class="Text sz-1" href="https://www.npmjs.com/package/@solidports/base-ui">
              npm
            </Link>
            <Link class="Text sz-1" href="https://bsky.app/profile/base-ui.com">
              Bluesky
            </Link>
          </nav>
        </footer>
      </div>
    </div>
  )
}
