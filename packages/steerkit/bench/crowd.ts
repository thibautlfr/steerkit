// One frame of 1,000 agents that wander, stay near home and keep away from a
// point: the readable form (blend) against the allocation-free one (zero,
// add). A baseline to compare changes against, not a gate. Plain Node, not
// Vitest, whose module runner adds overhead to every imported call:
// `pnpm bench`. Each form runs in its own process, as the JIT optimizes the
// shared functions for whichever runs first.

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import v8 from "node:v8";
import {
	type Agent,
	add,
	arrive,
	blend,
	createWanderState,
	keepAway,
	step,
	type Vec3,
	type WanderState,
	wander,
	zero,
} from "../src/index.ts";

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
		`${name.padEnd(10)}  ${ms.toFixed(3)} ms per frame  ${(perFrame / 1024).toFixed(1)} KiB allocated per frame`,
	);
}
