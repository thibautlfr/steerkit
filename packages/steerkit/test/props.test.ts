// Properties that must hold for any finite input, checked on random ones:
// no NaN or Infinity, and the bounds of Reynolds' model respected.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
	type Agent,
	alignment,
	arrive,
	brake,
	cohesion,
	createGrid,
	createNeighbors,
	createWanderState,
	evade,
	flee,
	follow,
	keepAway,
	offsetPursuit,
	prioritize,
	pursue,
	queryGrid,
	seek,
	separation,
	step,
	updateGrid,
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
	// The agent itself included, as a whole crowd would be
	const crowd = [agent, mover, { position: other, velocity: target }];
	const seen = { radius: distance, fieldOfView: Math.abs(distance) };
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
		separation(agent, crowd, { radius: distance }, { x: 0, y: 0, z: 0 }),
		separation(agent, crowd, seen, { x: 0, y: 0, z: 0 }),
		cohesion(agent, crowd, seen, { x: 0, y: 0, z: 0 }),
		alignment(agent, crowd, seen, { x: 0, y: 0, z: 0 }),
		offsetPursuit(
			agent,
			mover,
			{
				ahead: distance,
				side: -distance,
				slowingDistance: distance,
				plane: "xy",
			},
			{ x: 0, y: 0, z: 0 },
		),
		follow(
			agent,
			mover,
			{ distance, slowingDistance: distance, plane: "xy" },
			{ x: 0, y: 0, z: 0 },
		),
		follow(
			agent,
			mover,
			{ distance, slowingDistance: -distance, plane: "xy" },
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

describe("queryGrid", () => {
	it("finds what a scan of every item finds", () => {
		fc.assert(
			fc.property(
				fc.array(vec3, { maxLength: 60 }),
				vec3,
				fc.double({ min: 0, max: 500, noNaN: true }),
				fc.double({ min: 1e-3, max: 300, noNaN: true }),
				fc.constantFrom("xy", "xz", "yz", undefined),
				(positions, at, radius, cellSize, plane) => {
					const items = positions.map((position) => ({ position }));
					const grid = createGrid<{ position: Vec3 }>({
						cellSize,
						...(plane && { plane }),
					});
					const out = queryGrid(
						updateGrid(grid, items),
						at,
						radius,
						createNeighbors(),
					);
					const found = new Set(Array.from(out));
					const expected = items.filter(
						({ position: p }) =>
							Math.sqrt(
								(p.x - at.x) ** 2 + (p.y - at.y) ** 2 + (p.z - at.z) ** 2,
							) <= radius,
					);
					return (
						out.length === expected.length &&
						found.size === expected.length &&
						expected.every((item) => found.has(item))
					);
				},
			),
		);
	});
});
