import type { ParentProps } from "solid-js"
import { HydrationScript } from "@solidjs/web"

export default function Document(props: ParentProps) {
	return (
		<html lang="en">
			<head>
				<meta charset="utf-8" />
				<meta name="viewport" content="width=device-width, initial-scale=1" />
				<title>@solidports/base-ui</title>
				<link
					rel="preload"
					href="/fonts/die-grotesk-a-regular.woff2"
					as="font"
					type="font/woff2"
					crossorigin="anonymous"
				/>
				<link
					rel="preload"
					href="/fonts/die-grotesk-a-bold.woff2"
					as="font"
					type="font/woff2"
					crossorigin="anonymous"
				/>
				<link
					rel="preload"
					href="/fonts/die-grotesk-b-bold.woff2"
					as="font"
					type="font/woff2"
					crossorigin="anonymous"
				/>
				<link
					rel="preload"
					href="/fonts/paper-mono.woff2"
					as="font"
					type="font/woff2"
					crossorigin="anonymous"
				/>
				<HydrationScript />
			</head>
			<body>{props.children}</body>
		</html>
	)
}
