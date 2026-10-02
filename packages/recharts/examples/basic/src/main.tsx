/* @refresh reload */
import { render } from '@solidjs/web';
import { App } from "./App"
import "./styles.css"

const root = document.getElementById("root")
if (!root) throw new Error("@solidports/recharts-examples-basic: missing #root")

render(() => <App />, root)
