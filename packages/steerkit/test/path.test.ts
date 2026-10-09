import { describe, expect, it } from "vitest";
import { followPath, type Vec3 } from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

const expectClose = (actual: Vec3, expected: Vec3) => {
	expect(actual.x).toBeCloseTo(expected.x, 9);
	expect(actual.y).toBeCloseTo(expected.y, 9);
	expect(actual.z).toBeCloseTo(expected.z, 9);
};

const road = [vec(0, 0), vec(10, 0)];
const options = { radius: 0.5, lookAhead: 1 };

describe("followPath", () => {
	it("starts a still agent along the path", () => {
		const a = agent();
		expectClose(followPath(a, road, options, vec()), vec(2, 0, 0));
	});

	it("lets the agent go its own way within the radius, at full speed", () => {
		const a = agent({ position: vec(5, 0.1), velocity: vec(1, 0.1) });
		const k = 2 / Math.hypot(1, 0.1);
		expectClose(
			followPath(a, road, options, vec()),
			vec(k - 1, 0.1 * k - 0.1, 0),
		);
	});

	it("steers back to a point further along the path", () => {
		// In 1 s at (6, 2): nearest (6, 0), then 2 further: (8, 0)
		const a = agent({ position: vec(5, 2), velocity: vec(1, 0) });
		const k = 2 / Math.hypot(3, 2);
		expectClose(followPath(a, road, options, vec()), vec(3 * k - 1, -2 * k, 0));
	});

	it("turns back an agent heading the wrong way", () => {
		const a = agent({ position: vec(5, 0), velocity: vec(-1, 0) });
		expect(followPath(a, road, options, vec()).x).toBeGreaterThan(0);
	});

	it("arrives on the last point of an open path", () => {
		// 0.5 from the end, within the slowing distance (2): speed 0.5
		const a = agent({ position: vec(9.5, 0), velocity: vec(1, 0) });
		expectClose(followPath(a, road, options, vec()), vec(-0.5, 0, 0));
		a.position.x = 10;
		a.velocity.x = 0;
		expectClose(followPath(a, road, options, vec()), vec());
	});

	it("loops around a closed path", () => {
		const square = [vec(0, 0), vec(4, 0), vec(4, 4), vec(0, 4)];
		// Nearest (1, 4) on the top side, 2 further: (0, 3) on the way back
		const a = agent({ position: vec(1, 4) });
		const k = 2 / Math.SQRT2;
		expectClose(
			followPath(a, square, { ...options, closed: true }, vec()),
			vec(-k, -k, 0),
		);
	});

	it("arrives on a single point, and has nothing to do with none", () => {
		const a = agent({ position: vec(5, 0) });
		expectClose(followPath(a, [vec(0, 0)], options, vec()), vec(-2, 0, 0));
		expect(followPath(a, [], options, vec())).toEqual(vec());
	});

	it("may write into any of its inputs", () => {
		const make = () => ({
			a: agent({ position: vec(5, 2), velocity: vec(1, 0) }),
			points: [vec(0, 0), vec(10, 0)],
		});
		const s = make();
		const expected = followPath(s.a, s.points, options, vec());
		for (const pick of [
			(m: ReturnType<typeof make>) => m.a.position,
			(m: ReturnType<typeof make>) => m.a.velocity,
			(m: ReturnType<typeof make>) => m.points[1] as Vec3,
		]) {
			const m = make();
			expectClose(followPath(m.a, m.points, options, pick(m)), expected);
		}
	});
});
