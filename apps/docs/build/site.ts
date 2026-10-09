// A Vite plugin that turns the single-page app into a crawlable site: one
// prerendered HTML file per demo (its own title, description, canonical URL
// and link preview), plus llms.txt, sitemap.xml and robots.txt.

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";
import { home, type Page, pages, SITE } from "../src/pages.ts";
import { llms } from "./llms.ts";

const escapeHtml = (text: string): string =>
	text
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");

const structuredData = JSON.stringify({
	"@context": "https://schema.org",
	"@type": "SoftwareSourceCode",
	name: "steerkit",
	description: home.description,
	url: `${SITE}/`,
	codeRepository: "https://github.com/thibautlfr/steerkit",
	programmingLanguage: ["TypeScript", "JavaScript"],
	runtimePlatform: "JavaScript",
	license: "https://opensource.org/licenses/MIT",
	keywords:
		"steering behaviors, Craig Reynolds, autonomous agents, boids, game AI, Three.js",
	author: {
		"@type": "Person",
		name: "Thibaut Lefrançois",
		url: "https://thibaut-lefrancois.com",
	},
});

// The template's {{placeholders}} for a page: a demo, or the home page
// (which shows the first demo)
const fill = (html: string, page: Page | undefined): string => {
	const shown = page ?? pages[0];
	const values: Record<string, string> = {
		title: escapeHtml(
			page ? `${page.title}, interactive demo · steerkit` : home.title,
		),
		description: escapeHtml(page ? page.description : home.description),
		url: page ? `${SITE}/${page.id}/` : `${SITE}/`,
		site: SITE,
		h1: escapeHtml(shown?.title ?? ""),
		summary: escapeHtml(shown?.summary ?? ""),
		nav: pages
			.map(
				(p) =>
					`<li><a href="/${p.id}/"${p.id === shown?.id ? ' aria-current="page"' : ""}>${escapeHtml(p.title)}</a></li>`,
			)
			.join(""),
		jsonld: structuredData,
	};
	return html.replace(
		/\{\{(\w+)\}\}/g,
		(match, key: string) => values[key] ?? match,
	);
};

const pageAt = (url: string): Page | undefined => {
	const id = url.split(/[?#]/)[0]?.split("/").filter(Boolean)[0];
	return pages.find((p) => p.id === id);
};

const sitemap = (): string => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[`${SITE}/`, ...pages.map((p) => `${SITE}/${p.id}/`)]
	.map((loc) => `  <url><loc>${loc}</loc></url>`)
	.join("\n")}
</urlset>
`;

const robots = `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

export function site(): Plugin {
	let template = "";
	const files = (): Record<string, string> => ({
		"llms.txt": llms(pages),
		"sitemap.xml": sitemap(),
		"robots.txt": robots,
	});

	return {
		name: "steerkit-site",

		transformIndexHtml: {
			order: "post",
			handler(html, ctx) {
				if (ctx.server) return fill(html, pageAt(ctx.originalUrl ?? "/"));
				// The build fills the home page here, the others in writeBundle
				template = html;
				return fill(html, undefined);
			},
		},

		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				const name = req.url?.slice(1) ?? "";
				const body = files()[name];
				if (body === undefined) return next();
				res.setHeader(
					"Content-Type",
					name.endsWith(".xml")
						? "application/xml"
						: "text/plain; charset=utf-8",
				);
				res.end(body);
			});
		},

		writeBundle(options) {
			const dir = options.dir ?? "dist";
			for (const page of pages) {
				mkdirSync(join(dir, page.id), { recursive: true });
				writeFileSync(join(dir, page.id, "index.html"), fill(template, page));
			}
			for (const [name, body] of Object.entries(files())) {
				writeFileSync(join(dir, name), body);
			}
		},
	};
}
