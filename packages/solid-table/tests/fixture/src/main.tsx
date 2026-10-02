import { render } from "@solidjs/web";
import { GridDemo } from "./GridDemo";
import { HookDemo } from "./HookDemo";
import { VirtualDemo } from "./VirtualDemo";

const demos = { grid: GridDemo, hook: HookDemo, virtual: VirtualDemo };
const name = new URLSearchParams(location.search).get("demo") as keyof typeof demos | null;
const Demo = demos[name ?? "grid"];

render(() => <Demo />, document.getElementById("root")!);
