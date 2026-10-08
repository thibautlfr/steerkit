import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
	// "/steerkit/" on GitHub Pages, set by the deploy workflow
	base: process.env.DOCS_BASE ?? "/",
	resolve: {
		// The library's sources, so the demos follow edits without a rebuild
		alias: {
			steerkit: fileURLToPath(
				new URL("../../packages/steerkit/src/index.ts", import.meta.url),
			),
		},
	},
});
