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
	"neighbors.ts",
	"grid.ts",
	"leader.ts",
	"avoid.ts",
	"bounds.ts",
	"path.ts",
	"flow.ts",
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

> Craig Reynolds' steering behaviors for autonomous characters (seek, flee, arrive, pursue, evade, wander, keepAway, separation, cohesion, alignment, follow, offsetPursuit, avoidObstacles, avoidCollisions, stayWithin, followPath, followFlow…) as small, typed, engine-agnostic functions for JavaScript and TypeScript. They work on the project's own \`{ x, y, z }\` objects, \`THREE.Vector3\` included, with no dependency and no allocation per frame.

Install with the project's package manager: \`npm install steerkit\` (ESM only, TypeScript types included).

## How to use it

- An agent is any object with \`position\` and \`velocity\` (\`{ x, y, z }\`), \`maxSpeed\` (units per second), \`maxForce\` (units per second², low turns like a ship, high like a fly) and an optional \`mass\` (1 by default). A Three.js object can lend its own \`mesh.position\`: \`step\` moves it directly.
- Every behavior computes a steering force, writes it into the \`out\` vector passed last, and returns it. Create these vectors once and reuse them every frame; never allocate per frame.
- Each frame, per agent: compute the behaviors, combine their forces, then call \`step(agent, force, dt)\` once. \`dt\` is in seconds; clamp it (\`Math.min(dt, 1 / 20)\`) so a frame after the tab was in the background doesn't teleport agents.
- Combine with \`blend(out, [force, weight], …)\` (a weighted sum) or \`prioritize(out, agent.maxForce, …forces)\` (in order of priority within a budget, so a lesser force can't cancel an urgent one). For hundreds of agents, use their allocation-free forms: \`zero(out)\` then \`add(out, force, weight)\` or \`addWithin(out, budget, force)\`, with one temporary vector reused for every behavior. In such loops, also hoist options objects (\`{ slowingDistance: 1.2 }\`) out of the loop as constants.
- \`wander\` needs a state per agent, from \`createWanderState()\`, kept across frames.
- Groups (flocking): \`separation\`, \`cohesion\` and \`alignment\` take the agent's neighbors as any list of \`{ position, velocity }\`; the whole crowd works, the agent itself included (it is recognized by its \`position\` object and ignored). Up to a few dozen agents, pass the crowd's array as it is. Beyond, use the spatial grid: create \`createGrid({ cellSize })\` (cellSize about the largest radius queried) and \`createNeighbors()\` once; each frame, call \`updateGrid(grid, agents)\` once after moving them, then per agent \`queryGrid(grid, agent.position, radius, near)\` and pass its result as the neighbors. Never build a new array of neighbors per frame.
- Leaders: \`follow\` (a spot behind the leader, stepping out of its way) and \`offsetPursuit\` (a slot in a formation, \`ahead\` along the leader's heading and \`side\` to its right) take the leader as any \`{ position, velocity }\`. Create one options object per follower or slot, once. Combine \`follow\` with \`separation\` among the followers.
- The environment: \`avoidObstacles\` takes obstacles as any list of \`{ position, radius }\` (spheres, circles in 2D), \`avoidCollisions\` the other movers as any list of \`{ position, velocity }\` (the whole crowd, the agent itself included, or what \`queryGrid\` returns: query within about \`2 × maxSpeed × lookAhead + 2 × radius\`). \`stayWithin\` takes a box \`{ min, max }\` (\`THREE.Box3\` as is; give it no depth in 2D), \`followPath\` a list of points (\`closed: true\` for a loop), \`followFlow\` a function \`(position, out) => out\` writing the flow's direction, which must read \`position\` before writing \`out\` and allocate nothing. Their \`lookAhead\` is in seconds. Avoidance and containment return a zero force when nothing is in the way: put them first in \`prioritize\` (or \`addWithin\`), before what moves the agent.
- 2D: keep \`z\` at 0 everywhere; pass \`plane: "xy"\` to \`wander\`, \`follow\`, \`offsetPursuit\`, \`avoidObstacles\`, \`avoidCollisions\` and \`createGrid\` for a 2D canvas, \`plane: "xz"\` for characters on the ground in 3D. Without \`plane\`, \`wander\` roams on a sphere, in all three axes, and the leader and avoidance behaviors take +y as up.
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
