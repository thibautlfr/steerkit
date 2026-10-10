// One frame of 1,000 agents that wander, stay near home and keep away from a
// point: the readable form (blend) against the allocation-free one (zero,
// add). Then 1,000 boids flocking, and 1,000 agents wandering clear of each
// other, their neighbors found by scanning the whole crowd or by a spatial
// grid. Then the flock again, drawn for Three.js: instances and the forces. A baseline to compare changes against, not a gate. Plain Node, not
// Vitest, whose module runner adds overhead to every imported call:
// `pnpm bench`. Each form runs in its own process, as the JIT optimizes the
// shared functions for whichever runs first.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import v8 from "node:v8";
import { BufferGeometry, InstancedMesh, MeshBasicMaterial } from "three";
import {
	type Agent,
	add,
	addWithin,
	alignment,
	arrive,
	avoidCollisions,
	blend,
	cohesion,
	createGrid,
	createNeighbors,
	createWanderState,
	keepAway,
	queryGrid,
	separation,
	step,
	updateGrid,
	type Vec3,
	type WanderState,
	wander,
	zero,
} from "../src/index.ts";
import { SteeringHelper, setInstances } from "../src/three.ts";

const COUNT = 1_000;
const FRAMES = 2_000;
const DT = 1 / 60;

const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

// Math.random allocates in V8: a typed-array generator keeps the measure on
// the library's own allocations
const random = (): (() => number) => {
	const state = new Uint32Array([1]);
	return () => {
		state[0] = (state[0] ?? 0) * 1664525 + 1013904223;
		return (state[0] ?? 0) / 4294967296;
	};
};

type Member = { agent: Agent; state: WanderState; force: Vec3 };

const crowd = (): Member[] =>
	Array.from({ length: COUNT }, (_, i) => ({
		agent: {
			position: vec(Math.cos(i), Math.sin(i), (i % 10) / 10),
			velocity: vec(0.1, 0.2, 0.3),
			maxSpeed: 2,
			maxForce: 4,
		},
		state: createWanderState(random()),
		force: vec(),
	}));

const home = vec();
const danger = vec(0.5, 0.5, 0);
const wandering = { radius: 1, distance: 2, jitter: 2 };
const slowing = { slowingDistance: 3 };
const around = { radius: 1 };
const goal = vec();
const away = vec();
const roam = vec();

// Boids spread over a 60 × 60 square, wrapped around its edges so the
// density stays the same: a few neighbors within 2 units each
const SIDE = 60;
const flockRandom = random();
const boids: Agent[] = Array.from({ length: COUNT }, () => ({
	position: vec(flockRandom() * SIDE, flockRandom() * SIDE, 0),
	velocity: vec(flockRandom() - 0.5, flockRandom() - 0.5, 0),
	maxSpeed: 2,
	maxForce: 4,
}));
const boidForce = vec();
const close = { radius: 1 };
const sight = { radius: 2 };
const grid = createGrid<Agent>({ cellSize: 2, plane: "xy" });
const near = createNeighbors<Agent>();

const flock = (useGrid: boolean) => {
	if (useGrid) updateGrid(grid, boids);
	for (const boid of boids) {
		const neighbors = useGrid
			? queryGrid(grid, boid.position, sight.radius, near)
			: boids;
		zero(boidForce);
		add(boidForce, separation(boid, neighbors, close, roam), 1.5);
		add(boidForce, alignment(boid, neighbors, sight, roam), 1);
		add(boidForce, cohesion(boid, neighbors, sight, roam), 1);
		step(boid, boidForce, DT);
		const p = boid.position;
		p.x = ((p.x % SIDE) + SIDE) % SIDE;
		p.y = ((p.y % SIDE) + SIDE) % SIDE;
	}
};

// The flock as a Three.js scene would draw it: one instanced mesh, and
// Reynolds' diagram for every boid. No renderer: the uploads are three's
const mesh = new InstancedMesh(
	new BufferGeometry(),
	new MeshBasicMaterial(),
	COUNT,
);
const helper = new SteeringHelper({ capacity: COUNT * 19 });
const forces = boids.map(() => vec());

const drawnFlock = () => {
	updateGrid(grid, boids);
	helper.reset();
	for (let i = 0; i < boids.length; i++) {
		const boid = boids[i] as Agent;
		const force = forces[i] as Vec3;
		const neighbors = queryGrid(grid, boid.position, sight.radius, near);
		zero(force);
		add(force, separation(boid, neighbors, close, roam), 1.5);
		add(force, alignment(boid, neighbors, sight, roam), 1);
		add(force, cohesion(boid, neighbors, sight, roam), 1);
		step(boid, force, DT);
		const p = boid.position;
		p.x = ((p.x % SIDE) + SIDE) % SIDE;
		p.y = ((p.y % SIDE) + SIDE) % SIDE;
		helper.vectors(boid, force);
	}
	setInstances(mesh, boids);
};

// Wandering agents that steer clear of each other, avoidance first. The
// grid query reaches as far as two agents closing in at top speed get in
// `lookAhead`, plus their radii
const ahead = { radius: 0.3, lookAhead: 0.5, plane: "xy" as const };
const reach = 2 * 2 * ahead.lookAhead + 2 * ahead.radius;
const flat = { ...wandering, plane: "xy" as const };
const states = boids.map(() => createWanderState(random()));

const avoiding = (useGrid: boolean) => {
	if (useGrid) updateGrid(grid, boids);
	for (let i = 0; i < boids.length; i++) {
		const boid = boids[i] as Agent;
		const others = useGrid
			? queryGrid(grid, boid.position, reach, near)
			: boids;
		zero(boidForce);
		addWithin(
			boidForce,
			boid.maxForce,
			avoidCollisions(boid, others, ahead, roam),
		);
		addWithin(
			boidForce,
			boid.maxForce,
			wander(boid, states[i] as WanderState, flat, DT, roam),
		);
		step(boid, boidForce, DT);
		const p = boid.position;
		p.x = ((p.x % SIDE) + SIDE) % SIDE;
		p.y = ((p.y % SIDE) + SIDE) % SIDE;
	}
};

const frames: Record<string, (members: Member[]) => void> = {
	blend: (members) => {
		for (const { agent, state, force } of members) {
			blend(
				force,
				[wander(agent, state, wandering, DT, roam), 1],
				[arrive(agent, home, slowing, goal), 0.5],
				[keepAway(agent, danger, around, away), 2],
			);
			step(agent, force, DT);
		}
	},
	"zero + add": (members) => {
		for (const { agent, state, force } of members) {
			zero(force);
			add(force, wander(agent, state, wandering, DT, roam), 1);
			add(force, arrive(agent, home, slowing, goal), 0.5);
			add(force, keepAway(agent, danger, around, away), 2);
			step(agent, force, DT);
		}
	},
	"flocking, whole crowd": () => flock(false),
	"flocking, grid": () => flock(true),
	"avoiding, whole crowd": () => avoiding(false),
	"avoiding, grid": () => avoiding(true),
	"flocking, drawn": drawnFlock,
};

// Every byte V8 allocated so far (Node ≥ 22.18)
const allocated = (): number =>
	(v8.getHeapStatistics() as { total_allocated_bytes?: number })
		.total_allocated_bytes ?? Number.NaN;

const name = process.argv[2];
const frame = name && frames[name];
if (!frame) {
	for (const each of Object.keys(frames)) {
		spawnSync(process.execPath, [fileURLToPath(import.meta.url), each], {
			stdio: "inherit",
		});
	}
} else {
	const members = crowd();
	for (let i = 0; i < FRAMES / 4; i++) frame(members);
	const bytes = allocated();
	const start = performance.now();
	for (let i = 0; i < FRAMES; i++) frame(members);
	const ms = (performance.now() - start) / FRAMES;
	const perFrame = (allocated() - bytes) / FRAMES;
	console.log(
		`${name.padEnd(21)}  ${ms.toFixed(3)} ms per frame  ${(perFrame / 1024).toFixed(1)} KiB allocated per frame`,
	);
}
