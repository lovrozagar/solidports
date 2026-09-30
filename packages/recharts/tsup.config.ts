import { defineConfig } from "tsup"
import * as preset from "tsup-preset-solid"

export default defineConfig(config => {
	const parsed = preset.parsePresetOptions(
		{
			entries: [{ entry: "src/index.ts", dev_entry: true, server_entry: false }],
			drop_console: true,
		},
		!!config.watch,
	)
	return preset.generateTsupOptions(parsed)
})
