import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		// The library's sources, so the demos follow edits without a rebuild
		alias: {
			steerkit: fileURLToPath(
				new URL("../../packages/steerkit/src/index.ts", import.meta.url),
			),
		},
	},
});
