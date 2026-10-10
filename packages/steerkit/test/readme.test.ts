// Runs the README's first example as it is written, so it can't drift from
// the API: the import line becomes a lookup in the library, and the free
// variables it uses (target, camera, dt) are supplied here.

import { readFileSync } from "node:fs";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import * as steerkit from "../src/index.ts";
import * as steerkitThree from "../src/three.ts";
import { vec } from "./helpers.ts";

const readme = readFileSync(
	new URL("../../../README.md", import.meta.url),
	"utf8",
);
const example =
	readme.match(/## Example[\s\S]*?```ts\n([\s\S]*?)```/)?.[1] ?? "";
const threeExample =
	readme.match(/### Three\.js[\s\S]*?```ts\n([\s\S]*?)```/)?.[1] ?? "";

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

describe("the README's Three.js example", () => {
	it("runs, and draws the school, turns the shark and draws the forces", () => {
		const body = threeExample
			.replace('import * as THREE from "three";', "")
			.replace(
				/import \{([^}]*)\} from "steerkit\/three";/,
				"const {$1} = steerkitThree;",
			);
		expect(body).not.toContain("import");
		const run = new Function(
			"THREE",
			"steerkitThree",
			"geometry",
			"material",
			"school",
			"scene",
			"sharkMesh",
			"shark",
			"dt",
			"forces",
			"rock",
			`${body}\nreturn { fish, helper };`,
		) as (...args: unknown[]) => {
			fish: THREE.InstancedMesh;
			helper: steerkitThree.SteeringHelper;
		};

		const school = [0, 1, 2].map((i) => ({
			position: new THREE.Vector3(i, 0, 0),
			velocity: new THREE.Vector3(0, 0, -1),
		}));
		const sharkMesh = new THREE.Object3D();
		const scene = new THREE.Scene();
		const { fish, helper } = run(
			THREE,
			steerkitThree,
			new THREE.BufferGeometry(),
			new THREE.MeshBasicMaterial(),
			school,
			scene,
			sharkMesh,
			{ velocity: new THREE.Vector3(1, 0, 0) },
			1 / 60,
			school.map(() => new THREE.Vector3(0, 1, 0)),
			{ position: new THREE.Vector3(0, -2, 0), radius: 1 },
		);
		expect(scene.children).toHaveLength(3);
		expect(fish.count).toBe(3);
		const matrix = new THREE.Matrix4();
		fish.getMatrixAt(2, matrix);
		expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBe(2);
		expect(sharkMesh.quaternion.equals(new THREE.Quaternion())).toBe(false);
		expect(helper.geometry.drawRange.count).toBe(2 * (19 + 96));
	});
});
