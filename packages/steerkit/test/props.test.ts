// Properties that must hold for any finite input, checked on random ones:
// no NaN or Infinity, and the bounds of Reynolds' model respected.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	type Agent,
	arrive,
	brake,
	createWanderState,
	evade,
	flee,
	keepAway,
	prioritize,
	pursue,
	seek,
	step,
	type Vec3,
	wander,
} from "../src/index.ts";
import { length, seeded } from "./helpers.ts";

const coord = fc.double({ min: -1e3, max: 1e3, noNaN: true });
const vec3 = fc.record({ x: coord, y: coord, z: coord });
const vec2 = fc.record({ x: coord, y: coord, z: fc.constant(0) });
const positive = (max: number) =>
	fc.double({ min: 1e-3, max, noNaN: true, noDefaultInfinity: true });
const anyDistance = fc.double({ min: -10, max: 10, noNaN: true });

const agentOf = (v: fc.Arbitrary<Vec3>): fc.Arbitrary<Agent> =>
	fc.record(
		{
			position: v,
			velocity: v,
			maxSpeed: fc.double({ min: 0, max: 100, noNaN: true }),
			maxForce: fc.double({ min: 0, max: 1e3, noNaN: true }),
			mass: positive(100),
		},
		{ requiredKeys: ["position", "velocity", "maxSpeed", "maxForce"] },
	);
const anyAgent = agentOf(vec3);

const allFinite = (v: Vec3) =>
	Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

// Every behavior, as a function of random inputs
const behaviors = (
	agent: Agent,
	target: Vec3,
	other: Vec3,
	distance: number,
): Vec3[] => {
	const mover = { position: target, velocity: other };
	return [
		seek(agent, target, { x: 0, y: 0, z: 0 }),
		flee(agent, target, { x: 0, y: 0, z: 0 }),
		arrive(agent, target, { slowingDistance: distance }, { x: 0, y: 0, z: 0 }),
		keepAway(agent, target, { radius: distance }, { x: 0, y: 0, z: 0 }),
		brake(agent, { x: 0, y: 0, z: 0 }),
		pursue(agent, mover, {}, { x: 0, y: 0, z: 0 }),
		evade(
			agent,
			mover,
			{ maxPrediction: Math.abs(distance) },
			{ x: 0, y: 0, z: 0 },
		),
	];
};

describe("every behavior", () => {
	it("stays finite", () => {
		fc.assert(
			fc.property(anyAgent, vec3, vec3, anyDistance, (agent, t, o, d) =>
				behaviors(agent, t, o, d).every(allFinite),
			),
		);
	});

	it("stays finite on degenerate inputs", () => {
		const still: Agent = {
			position: { x: 1, y: 1, z: 1 },
			velocity: { x: 0, y: 0, z: 0 },
			maxSpeed: 0,
			maxForce: 0,
		};
		for (const d of [0, -1, 1]) {
			expect(
				behaviors(still, still.position, still.velocity, d).every(allFinite),
			).toBe(true);
		}
	});

	// The desired velocity is `force + velocity`. A null or partial force
	// (keepAway) desires the current velocity, which `step` then bounds
	it("never desires more than maxSpeed, or the current speed", () => {
		fc.assert(
			fc.property(anyAgent, vec3, vec3, anyDistance, (agent, t, o, d) =>
				behaviors(agent, t, o, d).every((force) => {
					const v = agent.velocity;
					const desired = Math.hypot(
						force.x + v.x,
						force.y + v.y,
						force.z + v.z,
					);
					const bound = Math.max(agent.maxSpeed, length(v));
					return desired <= bound * (1 + 1e-9) + 1e-9;
				}),
			),
		);
	});

	it("stays in the plane in 2D", () => {
		fc.assert(
			fc.property(agentOf(vec2), vec2, vec2, anyDistance, (agent, t, o, d) =>
				behaviors(agent, t, o, d).every((force) => force.z === 0),
			),
		);
	});
});

describe("wander", () => {
	it("stays finite and in its plane", () => {
		fc.assert(
			fc.property(
				agentOf(vec3),
				fc.integer(),
				positive(10),
				fc.double({ min: 0, max: 10, noNaN: true }),
				fc.double({ min: 0, max: 10, noNaN: true }),
				fc.constantFrom("xy", "xz", "yz", undefined),
				(agent, seed, radius, distance, jitter, plane) => {
					const state = createWanderState(seeded(seed));
					const force = { x: 0, y: 0, z: 0 };
					const opts = { radius, distance, jitter, ...(plane && { plane }) };
					for (let i = 0; i < 10; i++) {
						wander(agent, state, opts, 1 / 60, force);
						if (!allFinite(force)) return false;
						if (plane === "xy" && agent.velocity.z === 0 && force.z !== 0)
							return false;
					}
					return true;
				},
			),
		);
	});
});

describe("prioritize", () => {
	it("never exceeds its budget", () => {
		fc.assert(
			fc.property(
				fc.double({ min: 0, max: 1e3, noNaN: true }),
				fc.array(vec3, { maxLength: 6 }),
				(budget, forces) => {
					const out = prioritize({ x: 0, y: 0, z: 0 }, budget, ...forces);
					return allFinite(out) && length(out) <= budget * (1 + 1e-9) + 1e-9;
				},
			),
		);
	});
});

describe("step", () => {
	const dt = fc.double({ min: 0, max: 1, noNaN: true });

	it("never exceeds maxSpeed", () => {
		fc.assert(
			fc.property(anyAgent, vec3, dt, (agent, force, dt) => {
				step(agent, force, dt);
				return (
					allFinite(agent.position) &&
					length(agent.velocity) <= agent.maxSpeed * (1 + 1e-9) + 1e-9
				);
			}),
		);
	});

	it("never accelerates more than maxForce / mass", () => {
		fc.assert(
			fc.property(anyAgent, vec3, dt, (agent, force, dt) => {
				// No speed limit in the way, to see the raw acceleration
				const free = {
					...agent,
					maxSpeed: Infinity,
					velocity: { ...agent.velocity },
				};
				const before = { ...free.velocity };
				step(free, force, dt);
				const dv = Math.hypot(
					free.velocity.x - before.x,
					free.velocity.y - before.y,
					free.velocity.z - before.z,
				);
				return (
					dv <= (agent.maxForce / (agent.mass ?? 1)) * dt * (1 + 1e-9) + 1e-9
				);
			}),
		);
	});

	it("keeps a soft limit between maxSpeed and the previous speed", () => {
		fc.assert(
			fc.property(anyAgent, vec3, dt, positive(5), (agent, force, dt, tau) => {
				const previous = length(agent.velocity);
				step(agent, force, dt, { overspeedDamping: tau });
				const speed = length(agent.velocity);
				return (
					allFinite(agent.velocity) &&
					speed <= Math.max(agent.maxSpeed, previous) * (1 + 1e-9) + 1e-9
				);
			}),
		);
	});
});
