// Writes llms.txt, the documentation coding agents read
// (https://llmstxt.org): the rules of use by hand, and the API straight from
// the library's sources and doc comments, so it can't drift from the code.

import { readFileSync } from "node:fs";
import ts from "typescript";
import { type Page, SITE } from "../src/pages.ts";

const root = new URL("../../../", import.meta.url);
const read = (path: string): string =>
	readFileSync(new URL(path, root), "utf8");

// The files of the public API, in reading order
const SOURCES = [
	"types.ts",
	"basic.ts",
	"prediction.ts",
	"wander.ts",
	"combine.ts",
	"step.ts",
];

// The doc comments (/** */) right before a statement
const docComment = (source: string, node: ts.Node): string =>
	(ts.getLeadingCommentRanges(source, node.getFullStart()) ?? [])
		.map((range) => source.slice(range.pos, range.end))
		.filter((comment) => comment.startsWith("/**"))
		.join("\n");

// Type aliases in full, and function signatures without their bodies
const declarations = (file: string): string[] => {
	const source = read(`packages/steerkit/src/${file}`);
	const tree = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
	const out: string[] = [];
	for (const node of tree.statements) {
		const exported = ts
			.getModifiers(node as ts.HasModifiers)
			?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
		let text: string | undefined;
		if (ts.isTypeAliasDeclaration(node)) {
			text = node.getText(tree);
		} else if (ts.isFunctionDeclaration(node) && exported && node.body) {
			text = `${source.slice(node.getStart(tree), node.body.getStart(tree)).trim()};`;
		}
		if (text)
			out.push([docComment(source, node), text].filter(Boolean).join("\n"));
	}
	return out;
};

const example = (): string =>
	read("README.md").match(/## Example[\s\S]*?```ts\n([\s\S]*?)```/)?.[1] ?? "";

export const llms = (pages: Page[]): string => `# steerkit

> Craig Reynolds' steering behaviors for autonomous characters (seek, flee, arrive, pursue, evade, wander, keepAway…) as small, typed, engine-agnostic functions for JavaScript and TypeScript. They work on the project's own \`{ x, y, z }\` objects, \`THREE.Vector3\` included, with no dependency and no allocation per frame.

Install with the project's package manager: \`npm install steerkit\` (ESM only, TypeScript types included).

## How to use it

- An agent is any object with \`position\` and \`velocity\` (\`{ x, y, z }\`), \`maxSpeed\` (units per second), \`maxForce\` (units per second², low turns like a ship, high like a fly) and an optional \`mass\` (1 by default). A Three.js object can lend its own \`mesh.position\`: \`step\` moves it directly.
- Every behavior computes a steering force, writes it into the \`out\` vector passed last, and returns it. Create these vectors once and reuse them every frame; never allocate per frame.
- Each frame, per agent: compute the behaviors, combine their forces, then call \`step(agent, force, dt)\` once. \`dt\` is in seconds; clamp it (\`Math.min(dt, 1 / 20)\`) so a frame after the tab was in the background doesn't teleport agents.
- Combine with \`blend(out, [force, weight], …)\` (a weighted sum) or \`prioritize(out, agent.maxForce, …forces)\` (in order of priority within a budget, so a lesser force can't cancel an urgent one). For hundreds of agents, use their allocation-free forms: \`zero(out)\` then \`add(out, force, weight)\` or \`addWithin(out, budget, force)\`, with one temporary vector reused for every behavior. In such loops, also hoist options objects (\`{ slowingDistance: 1.2 }\`) out of the loop as constants.
- \`wander\` needs a state per agent, from \`createWanderState()\`, kept across frames.
- 2D: keep \`z\` at 0 everywhere; pass \`plane: "xy"\` to \`wander\` for a 2D canvas, \`plane: "xz"\` for characters on the ground in 3D. Without \`plane\`, \`wander\` roams on a sphere, in all three axes.
- Scale \`maxSpeed\`, \`maxForce\` and distances (\`slowingDistance\`, \`radius\`) to the project's units: the demos use a world about 10 units tall.
- steerkit only moves a point. Turning the model to face its velocity is up to the project (in Three.js: \`mesh.lookAt(tmp.copy(mesh.position).add(velocity))\`).
- When \`maxSpeed\` drops suddenly (the end of a speed boost), pass \`{ overspeedDamping: seconds }\` to \`step\` so the extra speed fades out instead of being cut in one frame.

## Example

\`\`\`ts
${example().trim()}
\`\`\`

## API

\`\`\`ts
${SOURCES.flatMap(declarations).join("\n\n")}
\`\`\`

## Demos

${pages.map((p) => `- [${p.title}](${SITE}/${p.id}/): ${p.description}`).join("\n")}

## Links

- [Repository and README](https://github.com/thibautlfr/steerkit)
- [npm package](https://www.npmjs.com/package/steerkit)
- [Craig Reynolds, Steering Behaviors For Autonomous Characters (GDC 1999)](https://www.red3d.com/cwr/steer/gdc99/)
`;
