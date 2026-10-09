import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { site } from "./build/site.ts";

const source = (file: string): string =>
	fileURLToPath(
		new URL(`../../packages/steerkit/src/${file}`, import.meta.url),
	);

export default defineConfig({
	plugins: [site()],
	resolve: {
		// The library's sources, so the demos follow edits without a rebuild.
		// Exact matches: a plain "steerkit" key would also catch
		// "steerkit/three", as "index.ts/three"
		alias: [
			{ find: /^steerkit\/three$/, replacement: source("three.ts") },
			{ find: /^steerkit$/, replacement: source("index.ts") },
		],
		// The adapter's sources resolve three from the library's own
		// node_modules: one copy of three for both
		dedupe: ["three"],
	},
	build: {
		// three is most of the aquarium's chunk, loaded on that page only
		chunkSizeWarningLimit: 800,
	},
});
