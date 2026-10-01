import { Progress } from "@solidports/flare-ui/progress";

export default function ProgressRoute() {
	return (
		<div class="p-8 space-y-4 max-w-sm">
			<Progress value={33} aria-label="Upload" />
			<Progress value={40} aria-label="Sync" />
			<Progress value={75} aria-label="Install" />
		</div>
	);
}
