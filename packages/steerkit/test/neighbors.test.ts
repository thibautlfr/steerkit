import { describe, expect, it } from "vitest";
import {
	alignment,
	cohesion,
	keepAway,
	type Mover,
	separation,
	type Vec3,
} from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

const mover = (position: Vec3, velocity = vec()): Mover => ({
	position,
	velocity,
});

const expectClose = (actual: Vec3, expected: Vec3) => {
	expect(actual.x).toBeCloseTo(expected.x, 9);
	expect(actual.y).toBeCloseTo(expected.y, 9);
	expect(actual.z).toBeCloseTo(expected.z, 9);
};

const around = { radius: 3 };

describe("separation", () => {
	it("flees a single neighbor as keepAway flees a point", () => {
		const a = agent({ velocity: vec(0, 1, 0) });
		const force = separation(a, [mover(vec(1, 0, 0))], around, vec());
		expectClose(force, keepAway(a, vec(1, 0, 0), around, vec()));
		// Fleeing at full speed, 2, scaled by 1 − 1/3
		expectClose(force, vec((-2 * 2) / 3, (-1 * 2) / 3, 0));
	});

	it("weighs each neighbor by 1/distance, and fades with the nearest", () => {
		// (−1, 0) / 1 + (0, −1) / 2: the nearer one weighs twice as much
		const force = separation(
			agent(),
			[mover(vec(1, 0, 0)), mover(vec(0, 2, 0))],
			around,
			vec(),
		);
		const k = (2 / Math.sqrt(1.25)) * (1 - 1 / 3);
		expectClose(force, vec(-1 * k, -0.5 * k, 0));
	});

	it("fades to nothing at the radius", () => {
		const near = separation(agent(), [mover(vec(0.5, 0, 0))], around, vec());
		const far = separation(agent(), [mover(vec(2.9, 0, 0))], around, vec());
		expect(near.x).toBeLessThan(far.x);
		expect(far.x).toBeCloseTo((-2 * 0.1) / 3, 9);
		expect(separation(agent(), [mover(vec(3, 0, 0))], around, vec()).x).toBe(
			-0,
		);
	});

	it("ignores neighbors beyond the radius", () => {
		const force = separation(agent(), [mover(vec(4, 0, 0))], around, vec());
		expect(force).toEqual(vec());
	});

	it("ignores the agent itself and a neighbor on the same spot", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const force = separation(a, [a, mover(vec())], around, vec());
		expect(force).toEqual(vec());
	});

	it("ignores neighbors outside the field of view", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const front = { radius: 3, fieldOfView: Math.PI };
		expect(separation(a, [mover(vec(-1, 0, 0))], front, vec())).toEqual(vec());
		expect(separation(a, [mover(vec(1, 1, 0))], front, vec()).x).toBeLessThan(
			0,
		);
	});

	it("sees all around at a stop", () => {
		const front = { radius: 3, fieldOfView: Math.PI };
		const force = separation(agent(), [mover(vec(-1, 0, 0))], front, vec());
		expect(force.x).toBeGreaterThan(0);
	});

	it("sees no one with a NaN radius", () => {
		const force = separation(
			agent(),
			[mover(vec(1, 0, 0))],
			{ radius: Number.NaN },
			vec(),
		);
		expect(force).toEqual(vec());
	});

	it("takes any array-like list", () => {
		const list = { length: 1, 0: mover(vec(1, 0, 0)) };
		expect(separation(agent(), list, around, vec()).x).toBeCloseTo(-4 / 3, 9);
	});
});

describe("cohesion", () => {
	it("pulls toward the center of the neighbors, maxSpeed at the radius", () => {
		// The center is (1, 1, 0); the pull is maxSpeed / radius per unit
		const force = cohesion(
			agent({ velocity: vec(0, 0, 5) }),
			[mover(vec(2, 0, 0)), mover(vec(0, 2, 0))],
			around,
			vec(),
		);
		expectClose(force, vec(2 / 3, 2 / 3, 0));
	});

	it("pulls nothing on the center itself", () => {
		const force = cohesion(
			agent({ velocity: vec(1, 0, 0) }),
			[mover(vec(-1, 0, 0)), mover(vec(1, 0, 0))],
			around,
			vec(),
		);
		expect(force).toEqual(vec());
	});

	it("is zero with no neighbor in sight", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		expect(cohesion(a, [a, mover(vec(9, 0, 0))], around, vec())).toEqual(vec());
	});
});

describe("alignment", () => {
	it("steers toward the average velocity", () => {
		const force = alignment(
			agent({ velocity: vec(0, 0, 1) }),
			[mover(vec(1, 0, 0), vec(1, 0, 0)), mover(vec(0, 1, 0), vec(0, 1, 0))],
			around,
			vec(),
		);
		expectClose(force, vec(0.5, 0.5, -1));
	});

	it("caps the average velocity at maxSpeed", () => {
		const force = alignment(
			agent(),
			[mover(vec(1, 0, 0), vec(4, 0, 0))],
			around,
			vec(),
		);
		expect(force).toEqual(vec(2, 0, 0));
	});

	it("is zero with no neighbor in sight", () => {
		expect(alignment(agent(), [], around, vec())).toEqual(vec());
	});
});

describe("out", () => {
	// Every input read before `out` is written: it may be any of them
	it.each([
		["separation", separation],
		["cohesion", cohesion],
		["alignment", alignment],
	])("%s may alias any input", (_, behavior) => {
		const make = () => {
			const a = agent({ position: vec(0.5, 0, 0), velocity: vec(1, 0.5, 0) });
			const n1 = mover(vec(1, 1, 0), vec(0, 1, 0));
			const n2 = mover(vec(-1, 0.5, 0), vec(1, 1, 0));
			return { a, n1, n2 };
		};
		const fresh = make();
		const expected = behavior(fresh.a, [fresh.n1, fresh.n2], around, vec());
		for (const pick of [
			(s: ReturnType<typeof make>) => s.a.position,
			(s: ReturnType<typeof make>) => s.a.velocity,
			(s: ReturnType<typeof make>) => s.n1.position,
			(s: ReturnType<typeof make>) => s.n2.velocity,
		]) {
			const s = make();
			const out = behavior(s.a, [s.n1, s.n2], around, pick(s));
			expectClose(out, expected);
		}
	});
});
