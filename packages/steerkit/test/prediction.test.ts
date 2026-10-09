import { describe, expect, it } from "vitest";
import { evade, flee, pursue, seek, step } from "../src/index.ts";
import { agent, length, vec } from "./helpers.ts";

describe("pursue", () => {
	it("seeks a still quarry where it is", () => {
		const quarry = { position: vec(5, 0, 0), velocity: vec() };
		expect(pursue(agent(), quarry, {}, vec())).toEqual(
			seek(agent(), quarry.position, vec()),
		);
	});

	it("aims ahead of a moving quarry", () => {
		const quarry = { position: vec(4, 0, 0), velocity: vec(0, 2, 0) };
		// They'd meet in 4 / (2 + 2) = 1 s: aims at (4, 2, 0)
		expect(pursue(agent(), quarry, {}, vec())).toEqual(
			seek(agent(), vec(4, 2, 0), vec()),
		);
	});

	it("predicts no further than maxPrediction", () => {
		const quarry = { position: vec(4, 0, 0), velocity: vec(0, 2, 0) };
		const force = pursue(agent(), quarry, { maxPrediction: 0 }, vec());
		expect(force).toEqual(seek(agent(), quarry.position, vec()));
	});

	it("catches a quarry running across faster than plain seek", () => {
		const timeToCatch = (steer: typeof pursue | "seek"): number => {
			const hunter = agent({ maxSpeed: 3, maxForce: 20 });
			const quarry = { position: vec(10, 0, 0), velocity: vec(0, 1.5, 0) };
			const force = vec();
			for (let t = 0; t < 30; t += 0.01) {
				if (steer === "seek") seek(hunter, quarry.position, force);
				else steer(hunter, quarry, {}, force);
				step(hunter, force, 0.01);
				quarry.position.y += quarry.velocity.y * 0.01;
				const d = vec(
					quarry.position.x - hunter.position.x,
					quarry.position.y - hunter.position.y,
				);
				if (length(d) < 0.5) return t;
			}
			return Infinity;
		};
		expect(timeToCatch(pursue)).toBeLessThan(timeToCatch("seek"));
	});
});

describe("evade", () => {
	it("flees a still threat where it is", () => {
		const threat = { position: vec(0, 3, 0), velocity: vec() };
		expect(evade(agent(), threat, {}, vec())).toEqual(
			flee(agent(), threat.position, vec()),
		);
	});

	it("flees where the threat will be", () => {
		const threat = { position: vec(4, 0, 0), velocity: vec(0, 2, 0) };
		// It'll be at (4, 2, 0) in 4 / (2 + 2) = 1 s
		expect(evade(agent(), threat, {}, vec())).toEqual(
			flee(agent(), vec(4, 2, 0), vec()),
		);
	});
});
