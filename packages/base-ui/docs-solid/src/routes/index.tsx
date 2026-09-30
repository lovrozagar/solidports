import { For } from "solid-js"
import { navigation } from "../data/navigation"

export default function Home() {
	return (
		<main style={{ margin: "0 auto", "max-width": "64rem", padding: "2rem" }}>
			<h1 style={{ "margin-bottom": "0.25rem" }}>@solidports/base-ui docs</h1>
			<p style={{ color: "#888", "margin-bottom": "2rem" }}>
				SolidStart mirror of upstream Base UI React docs.
			</p>

			<For each={navigation}>
				{(section) => (
					<section style={{ "margin-bottom": "2rem" }}>
						<h2 style={{ "font-size": "1.125rem", "margin-bottom": "0.5rem" }}>{section.title}</h2>
						<ul
							style={{
								display: "grid",
								gap: "0.25rem",
								"grid-template-columns": "repeat(auto-fill, minmax(12rem, 1fr))",
								"list-style": "none",
								margin: "0",
								padding: "0",
							}}
						>
							<For each={section.pages}>
								{(page) => (
									<li>
										<a href={page.path} style={{ color: "#60a5fa", "text-decoration": "none" }}>
											{page.title}
										</a>
									</li>
								)}
							</For>
						</ul>
					</section>
				)}
			</For>
		</main>
	)
}
