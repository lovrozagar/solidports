import { createHandler, StartServer } from "@solidjs/start/server"

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>@solidports/base-ui</title>
          <link rel="preload" href="/fonts/regular.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
          <link rel="preload" href="/fonts/medium.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
          <link rel="preload" href="/fonts/bold.woff2" as="font" type="font/woff2" crossorigin="anonymous" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
))
