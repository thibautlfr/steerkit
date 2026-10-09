// Checks that the per-frame functions allocate nothing, so a crowd of agents
// never wakes the garbage collector up. V8 counts every byte it allocates
// (`total_allocated_bytes`, Node ≥ 22.18): the count over a loop, once the
// JIT has optimized it, is what the loop allocates.

import v8 from "node:v8";
import { describe, expect, it } from "vitest";
import {
	add,
	addWithin,
	alignment,
	arrive,
	avoidCollisions,
	avoidObstacles,
	blend,
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
	pursue,
	queryGrid,
	seek,
	separation,
	stayWithin,
	step,
	updateGrid,
	wander,
	zero,
} from "../src/index.ts";
import { agent, seeded, vec } from "./helpers.ts";

const allocated = (): number | undefined =>
	(v8.getHeapStatistics() as { total_allocated_bytes?: number })
		.total_allocated_bytes;

const CALLS = 50_000;

// Bytes allocated per call of `frame`: the least over a few rounds, as the
// first ones also count the JIT's own work
const bytesPerCall = (frame: (i: number) => void): number => {
	let least = Infinity;
	for (let round = 0; round < 8; round++) {
		const before = allocated() ?? 0;
		for (let i = 0; i < CALLS; i++) frame(i);
		least = Math.min(least, ((allocated() ?? 0) - before) / CALLS);
	}
	return least;
};

// Less than one number boxed every other call: the noise of the measure
const NONE = 6;
// Less than the smallest vector, array or object: what's left is V8 boxing a
// number at a call it didn't inline, which the engine decides, not the code
const NO_OBJECT = 24;

describe.runIf(allocated() !== undefined)("allocation", () => {
	const a = agent({ velocity: vec(0.3, 0.1, 0) });
	// Options hoisted out of the loop, as the README advises: a literal
	// escapes when V8 doesn't inline the call (wander, step)
	const soft = { overspeedDamping: 0.5 };
	const slowing = { slowingDistance: 2 };
	const around = { radius: 1 };
	const wandering = { radius: 1, distance: 2, jitter: 1 };
	const quarry = { position: vec(5, 1, 2), velocity: vec(0, 1, 0) };
	const state = createWanderState(seeded(1));
	const target = vec(5, 0, 0);
	const crowd = [
		a,
		quarry,
		{ position: vec(0.5, 0.5, 0), velocity: vec(1, 0, 0) },
	];
	const seen = { radius: 10, fieldOfView: 4 };
	const slot = { ahead: -1, side: 1, slowingDistance: 2 };
	const behind = { distance: 1, slowingDistance: 2 };
	const rocks = [
		{ position: vec(2, 0.2, 0), radius: 0.5 },
		{ position: vec(4, -0.3, 0), radius: 1 },
	];
	const avoiding = { radius: 0.5, lookAhead: 30, plane: "xy" as const };
	const room = { min: vec(-1, -1, -1), max: vec(1, 1, 1) };
	const walls = { margin: 0.5, lookAhead: 1 };
	const force = vec();
	const tmp = vec();

	it.each([
		["seek", () => seek(a, target, force)],
		["flee", () => flee(a, target, force)],
		["arrive", () => arrive(a, target, slowing, force)],
		["keepAway", () => keepAway(a, target, around, force)],
		["brake", () => brake(a, force)],
		["pursue", () => pursue(a, quarry, {}, force)],
		["evade", () => evade(a, quarry, {}, force)],
		// With a seeded random: V8's Math.random allocates on its own
		["wander", () => wander(a, state, wandering, 0.016, force)],
		["separation", () => separation(a, crowd, seen, force)],
		["cohesion", () => cohesion(a, crowd, seen, force)],
		["alignment", () => alignment(a, crowd, seen, force)],
		["offsetPursuit", () => offsetPursuit(a, quarry, slot, force)],
		["follow", () => follow(a, quarry, behind, force)],
		["avoidObstacles", () => avoidObstacles(a, rocks, avoiding, force)],
		["avoidCollisions", () => avoidCollisions(a, crowd, avoiding, force)],
		["stayWithin", () => stayWithin(a, room, walls, force)],
		["zero + add", () => add(zero(force), target, 2)],
		["addWithin", () => addWithin(zero(force), 3, target)],
		["step", () => step(a, force, 0.016, soft)],
	])("%s allocates nothing", (_, behavior) => {
		expect(bytesPerCall(behavior)).toBeLessThan(NONE);
	});

	it("a whole frame allocates no vector, array or object", () => {
		const frame = (i: number) => {
			target.x = Math.sin(i);
			zero(force);
			add(force, arrive(a, target, slowing, tmp), 1);
			addWithin(force, a.maxForce, keepAway(a, quarry.position, around, tmp));
			step(a, force, 0.016, soft);
		};
		expect(bytesPerCall(frame)).toBeLessThan(NO_OBJECT);
	});

	it("a grid allocates nothing once it holds the crowd", () => {
		const random = seeded(2);
		const boids = Array.from({ length: 50 }, () =>
			agent({
				position: vec(random() * 10, random() * 10, 0),
				velocity: vec(random() - 0.5, random() - 0.5, 0),
			}),
		);
		const grid = createGrid({ cellSize: 2, plane: "xy" });
		const near = createNeighbors<(typeof boids)[number]>();
		const frame = (i: number) => {
			const boid = boids[i % boids.length] as (typeof boids)[number];
			// A moving crowd, so the cells and the counts change
			boid.position.x = (boid.position.x + 0.37) % 10;
			updateGrid(grid, boids);
			queryGrid(grid, boid.position, 2, near);
		};
		expect(bytesPerCall(frame)).toBeLessThan(NONE);
	});

	it("a whole flocking frame allocates no vector, array or object", () => {
		const random = seeded(3);
		const boids = Array.from({ length: 200 }, () =>
			agent({
				position: vec(random() * 20, random() * 20, 0),
				velocity: vec(random() - 0.5, random() - 0.5, 0),
			}),
		);
		const grid = createGrid({ cellSize: 2, plane: "xy" });
		const near = createNeighbors<(typeof boids)[number]>();
		const close = { radius: 1 };
		const frame = (i: number) => {
			const boid = boids[i % boids.length] as (typeof boids)[number];
			if (i % boids.length === 0) updateGrid(grid, boids);
			queryGrid(grid, boid.position, 2, near);
			zero(force);
			add(force, separation(boid, near, close, tmp), 1.5);
			add(force, alignment(boid, near, seen, tmp), 1);
			add(force, cohesion(boid, near, seen, tmp), 1);
			step(boid, force, 0.016);
		};
		expect(bytesPerCall(frame)).toBeLessThan(NO_OBJECT);
	});

	it("sees an allocation (control)", () => {
		let sink: unknown;
		const frame = (i: number) => {
			sink = seek(a, target, vec(i));
		};
		expect(bytesPerCall(frame)).toBeGreaterThan(NONE);
		expect(sink).toBeDefined();
	});

	it("reports what blend allocates", () => {
		// Its rest array and tuples, unless V8 manages to elide them once
		// blend is inlined: documented, not asserted
		const bytes = bytesPerCall(() =>
			blend(force, [target, 1], [quarry.position, 2]),
		);
		console.info(`blend: ${bytes.toFixed(1)} bytes per call`);
	});
});
