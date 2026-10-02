/* @refresh reload */
import { render } from '@solidjs/web';
import { App } from "./App"
import "./app.css"

const root = document.getElementById("root")
if (!root) throw new Error("@solidports/recharts-examples-shadcn: missing #root")

render(() => <App />, root)
