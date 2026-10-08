// Runs the README's first example as it is written, so it can't drift from
// the API: the import line becomes a lookup in the library, and the free
// variables it uses (target, camera, dt) are supplied here.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as steerkit from "../src/index.ts";
import { vec } from "./helpers.ts";

const readme = readFileSync(
	new URL("../../../README.md", import.meta.url),
	"utf8",
);
const example =
	readme.match(/## Example[\s\S]*?```ts\n([\s\S]*?)```/)?.[1] ?? "";

describe("the README example", () => {
	it("runs, and sets the fairy off toward its target", () => {
		const body = example.replace(
			/import \{([^}]*)\} from "steerkit";/,
			"const {$1} = steerkit;",
		);
		expect(body).not.toBe(example);
		// One frame per call, returning the fairy to check on it
		const frame = new Function(
			"steerkit",
			"target",
			"camera",
			"dt",
			`${body}\nreturn fairy;`,
		) as (
			lib: typeof steerkit,
			target: steerkit.Vec3,
			camera: steerkit.Vec3,
			dt: number,
		) => steerkit.Agent;

		const fairy = frame(steerkit, vec(3, 0, 0), vec(0, 5, 0), 1 / 60);
		expect(fairy.velocity.x).toBeGreaterThan(0);
		expect(fairy.velocity.y).toBe(0);
	});
});
