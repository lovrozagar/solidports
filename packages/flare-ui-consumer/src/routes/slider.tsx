import { Slider } from "@solidports/flare-ui/slider";

export default function SliderRoute() {
	return (
		<div class="p-8 max-w-sm space-y-6">
			<Slider defaultValue={[50]} min={0} max={100} aria-label="Volume" />
			<Slider defaultValue={[25]} min={0} max={100} disabled aria-label="Muted volume" />
		</div>
	);
}
