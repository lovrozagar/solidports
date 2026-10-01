import { Form } from "@solidports/flare-ui/form";
import { Input } from "@solidports/flare-ui/input";
import { Button } from "@solidports/flare-ui/button";
import { Label } from "@solidports/flare-ui/label";

export default function FormRoute() {
	return (
		<Form class="max-w-sm" onSubmit={(e) => e.preventDefault()}>
			<div class="space-y-1">
				<Label for="email">Email</Label>
				<Input id="email" type="email" placeholder="m@example.com" />
			</div>
			<div class="space-y-1">
				<Label for="password">Password</Label>
				<Input id="password" type="password" />
			</div>
			<Button type="submit">Sign in</Button>
		</Form>
	);
}
