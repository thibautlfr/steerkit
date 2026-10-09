import { describe, expect, it } from "vitest";
import { type FlowField, followFlow, type Vec3 } from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

const expectClose = (actual: Vec3, expected: Vec3) => {
	expect(actual.x).toBeCloseTo(expected.x, 9);
	expect(actual.y).toBeCloseTo(expected.y, 9);
	expect(actual.z).toBeCloseTo(expected.z, 9);
};

// Rightward on the right half, upward on the left, none on the line
const field: FlowField = (p, out) => {
	const x = p.x;
	out.x = x > 0 ? 3 : 0;
	out.y = x < 0 ? 3 : 0;
	out.z = 0;
	return out;
};

describe("followFlow", () => {
	it("heads the way the flow points, at full speed", () => {
		const a = agent({ position: vec(1, 0) });
		expectClose(followFlow(a, field, { lookAhead: 0 }, vec()), vec(2, 0, 0));
	});

	it("reads the flow where the agent will be", () => {
		const a = agent({ position: vec(-0.5, 0), velocity: vec(1, 0) });
		expectClose(followFlow(a, field, { lookAhead: 1 }, vec()), vec(1, 0, 0));
		expectClose(followFlow(a, field, { lookAhead: 0 }, vec()), vec(-1, 2, 0));
	});

	it("does nothing where the flow is null", () => {
		const a = agent({ velocity: vec(1, 0) });
		const at = { lookAhead: 0 };
		expect(followFlow(a, field, at, vec())).toEqual(vec());
	});

	it("may write into any of its inputs", () => {
		const make = () => agent({ position: vec(-0.5, 0), velocity: vec(1, 0) });
		const expected = followFlow(make(), field, { lookAhead: 1 }, vec());
		const a = make();
		expectClose(followFlow(a, field, { lookAhead: 1 }, a.position), expected);
		const b = make();
		expectClose(followFlow(b, field, { lookAhead: 1 }, b.velocity), expected);
	});
});
