import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { type Agent, arrive, seek, step } from "../src/index.ts";
import { agent, length, vec } from "./helpers.ts";

describe("step", () => {
	it("moves the agent along the force over dt", () => {
		const a = agent();
		step(a, vec(1, 0, 0), 0.5);
		expect(a.velocity).toEqual(vec(0.5, 0, 0));
		expect(a.position).toEqual(vec(0.25, 0, 0));
	});

	it("bounds the force by maxForce", () => {
		const a = agent({ maxForce: 1 });
		step(a, vec(0, 100, 0), 1);
		expect(a.velocity).toEqual(vec(0, 1, 0));
	});

	it("bounds the speed by maxSpeed", () => {
		const a = agent({ velocity: vec(1.5, 0, 0) });
		step(a, vec(0, 10, 0), 1);
		expect(length(a.velocity)).toBeCloseTo(2);
	});

	it("divides the force by the mass", () => {
		const a = agent({ mass: 4 });
		step(a, vec(2, 0, 0), 1);
		expect(a.velocity).toEqual(vec(0.5, 0, 0));
	});

	it("leaves the force untouched", () => {
		const force = vec(0, 100, 0);
		step(agent({ maxForce: 1 }), force, 1);
		expect(force).toEqual(vec(0, 100, 0));
	});
});

// The end of a speed boost: maxSpeed drops from 4 to 2 while the agent
// cruises at 4
describe("step when maxSpeed drops", () => {
	const boosted = (): Agent =>
		agent({ velocity: vec(4, 0, 0), maxSpeed: 2, maxForce: 10 });

	it("cuts the speed at once by default", () => {
		const a = boosted();
		step(a, seek(a, vec(100, 0, 0), vec()), 1 / 60);
		expect(length(a.velocity)).toBeCloseTo(2);
	});

	it("fades the extra speed out with overspeedDamping", () => {
		const a = boosted();
		const speeds = [];
		for (let i = 0; i < 120; i++) {
			step(a, vec(), 1 / 60, { overspeedDamping: 0.5 });
			speeds.push(length(a.velocity));
		}
		// Decreasing, never below the limit, and close to it after 4τ
		for (let i = 1; i < speeds.length; i++) {
			expect(speeds[i]).toBeLessThan(speeds[i - 1] ?? Infinity);
		}
		expect(Math.min(...speeds)).toBeGreaterThan(2);
		expect(speeds.at(-1)).toBeCloseTo(2 + 2 * Math.exp(-4), 9);
	});

	it("doesn't cut the momentum at once while steering", () => {
		const a = boosted();
		step(a, seek(a, vec(100, 0, 0), vec()), 1 / 60, {
			overspeedDamping: 0.5,
		});
		expect(length(a.velocity)).toBeGreaterThan(3.9);
	});

	it("fades the same at any framerate", () => {
		const speedAfter = (fps: number): number => {
			const a = boosted();
			for (let i = 0; i < fps; i++) {
				step(a, vec(), 1 / fps, { overspeedDamping: 0.5 });
			}
			return length(a.velocity);
		};
		expect(speedAfter(30)).toBeCloseTo(speedAfter(144), 9);
		expect(speedAfter(30)).toBeCloseTo(2 + 2 * Math.exp(-2), 9);
	});

	it("still lets the force turn the agent", () => {
		const a = boosted();
		step(a, vec(0, 10, 0), 0.1, { overspeedDamping: 0.5 });
		expect(a.velocity.y).toBeGreaterThan(0);
	});

	it("never speeds the agent up past maxSpeed", () => {
		const a = agent({ velocity: vec(2, 0, 0) });
		step(a, vec(10, 0, 0), 1, { overspeedDamping: 0.5 });
		expect(length(a.velocity)).toBeCloseTo(2);
	});
});

describe("with THREE.Vector3", () => {
	it("steers three.js vectors as they are", () => {
		const a: Agent = {
			position: new THREE.Vector3(),
			velocity: new THREE.Vector3(),
			maxSpeed: 2,
			maxForce: 10,
		};
		const force = arrive(
			a,
			new THREE.Vector3(5, 0, 0),
			{ slowingDistance: 1 },
			new THREE.Vector3(),
		);
		step(a, force, 0.5);
		expect(force).toBeInstanceOf(THREE.Vector3);
		expect(a.position).toEqual(new THREE.Vector3(0.5, 0, 0));
	});
});
