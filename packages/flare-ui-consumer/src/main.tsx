import { render } from "solid-js/web";
import { App } from "./app.tsx";
import "./app.css";

const root = document.getElementById("root");
if (!root) {
	throw new Error("@solidports/flare-ui-consumer: #root not found");
}

render(() => <App />, root);
