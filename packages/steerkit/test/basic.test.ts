import { describe, expect, it } from "vitest";
import { arrive, brake, flee, keepAway, seek } from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

describe("seek", () => {
	it("heads to the target at full speed from a stop", () => {
		expect(seek(agent(), vec(5, 0, 0), vec())).toEqual(vec(2, 0, 0));
	});

	it("cancels the velocity that doesn't lead to the target", () => {
		const a = agent({ velocity: vec(0, 1, 0) });
		expect(seek(a, vec(5, 0, 0), vec())).toEqual(vec(2, -1, 0));
	});

	it("brakes on the target itself", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		expect(seek(a, vec(), vec())).toEqual(vec(-1, 0, 0));
	});
});

describe("flee", () => {
	it("heads away from the threat at full speed", () => {
		expect(flee(agent(), vec(0, 0, 3), vec())).toEqual(vec(0, 0, -2));
	});
});

describe("arrive", () => {
	it("seeks when outside the slowing distance", () => {
		const target = vec(5, 0, 0);
		expect(arrive(agent(), target, { slowingDistance: 1 }, vec())).toEqual(
			seek(agent(), target, vec()),
		);
	});

	it("slows down within the slowing distance", () => {
		const force = arrive(
			agent(),
			vec(0.5, 0, 0),
			{ slowingDistance: 1 },
			vec(),
		);
		expect(force).toEqual(vec(1, 0, 0));
	});

	it("stops on the target", () => {
		const a = agent({ velocity: vec(1, 2, 3) });
		expect(arrive(a, vec(), { slowingDistance: 1 }, vec())).toEqual(
			vec(-1, -2, -3),
		);
	});

	it("seeks when the slowing distance is 0", () => {
		const target = vec(0.1, 0, 0);
		expect(arrive(agent(), target, { slowingDistance: 0 }, vec())).toEqual(
			seek(agent(), target, vec()),
		);
		expect(arrive(agent(), vec(), { slowingDistance: 0 }, vec())).toEqual(
			vec(),
		);
	});
});

describe("keepAway", () => {
	it("does nothing outside the radius", () => {
		expect(keepAway(agent(), vec(2, 0, 0), { radius: 1 }, vec())).toEqual(
			vec(),
		);
	});

	it("pushes harder the closer the agent gets", () => {
		const near = keepAway(agent(), vec(0.25, 0, 0), { radius: 1 }, vec());
		const far = keepAway(agent(), vec(0.75, 0, 0), { radius: 1 }, vec());
		expect(near.x).toBeLessThan(far.x);
		expect(far.x).toBeLessThan(0);
	});

	it("fades to nothing at the edge", () => {
		const edge = keepAway(agent(), vec(0.999, 0, 0), { radius: 1 }, vec());
		expect(Math.abs(edge.x)).toBeLessThan(0.01);
	});

	it("stays finite on the point itself", () => {
		expect(keepAway(agent(), vec(), { radius: 1 }, vec())).toEqual(vec());
	});
});

describe("brake", () => {
	it("opposes the velocity", () => {
		expect(brake(agent({ velocity: vec(1, -2, 3) }), vec())).toEqual(
			vec(-1, 2, -3),
		);
	});
});

describe("aliasing", () => {
	it("can write into the target", () => {
		const target = vec(5, 0, 0);
		expect(seek(agent(), target, target)).toEqual(vec(2, 0, 0));
	});

	it("can write into the agent's velocity", () => {
		const a = agent({ velocity: vec(0, 1, 0) });
		expect(seek(a, vec(5, 0, 0), a.velocity)).toEqual(vec(2, -1, 0));
	});
});
