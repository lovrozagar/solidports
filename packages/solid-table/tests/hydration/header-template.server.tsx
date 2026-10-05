import { renderToString } from "@solidjs/web";
import { HeaderTemplateFixture } from "./header-template.fixture";

export function render(): string {
	return renderToString(() => <HeaderTemplateFixture />);
}
