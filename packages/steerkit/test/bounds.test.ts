import { describe, expect, it } from "vitest";
import { stayWithin, type Vec3 } from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

const expectClose = (actual: Vec3, expected: Vec3) => {
	expect(actual.x).toBeCloseTo(expected.x, 9);
	expect(actual.y).toBeCloseTo(expected.y, 9);
	expect(actual.z).toBeCloseTo(expected.z, 9);
};

// A 2D room: no depth
const room = { min: vec(0, 0, 0), max: vec(10, 10, 0) };
const options = { margin: 1, lookAhead: 0.5 };

describe("stayWithin", () => {
	it("lets the agent be while it stays clear of the walls", () => {
		const a = agent({ position: vec(5, 5), velocity: vec(2, 1) });
		expect(stayWithin(a, room, options, vec())).toEqual(vec());
	});

	it("turns back before the margin, keeping the velocity along the wall", () => {
		// In 0.5 s at x = 9.5, past the margin at 9
		const a = agent({ position: vec(8.5, 5), velocity: vec(2, 1) });
		const k = 2 / Math.sqrt(5);
		expectClose(stayWithin(a, room, options, vec()), vec(-2 * k - 2, k - 1, 0));
	});

	it("brings back an agent out of the box", () => {
		const a = agent({ position: vec(-3, 12), velocity: vec() });
		const k = 2 / Math.sqrt(2);
		expectClose(stayWithin(a, room, options, vec()), vec(k, -k, 0));
	});

	it("keeps the agent on the middle of a box narrower than the margins", () => {
		const corridor = { min: vec(0, 0, 0), max: vec(10, 1, 0) };
		const a = agent({ position: vec(5, 0.2), velocity: vec(1, 0) });
		const force = stayWithin(a, corridor, options, vec());
		expect(force.y).toBeGreaterThan(0);
		a.position.y = 0.5;
		expect(stayWithin(a, corridor, options, vec())).toEqual(vec());
	});

	it("may write into any of its inputs", () => {
		const make = () => agent({ position: vec(8.5, 5), velocity: vec(2, 1) });
		const expected = stayWithin(make(), room, options, vec());
		const a = make();
		expectClose(stayWithin(a, room, options, a.velocity), expected);
		const b = make();
		expectClose(stayWithin(b, room, options, b.position), expected);
		const box = { min: vec(0, 0, 0), max: vec(10, 10, 0) };
		expectClose(stayWithin(make(), box, options, box.max), expected);
	});
});
