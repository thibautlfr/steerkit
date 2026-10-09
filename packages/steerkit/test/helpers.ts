import type { Agent, Vec3 } from "../src/index.ts";

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

export const agent = (overrides: Partial<Agent> = {}): Agent => ({
	position: vec(),
	velocity: vec(),
	maxSpeed: 2,
	maxForce: 10,
	...overrides,
});

export const length = (v: Vec3): number => Math.hypot(v.x, v.y, v.z);

// A small seeded generator (mulberry32), for reproducible randomness. Its
// state lives in a typed array: a 32-bit integer kept in a plain variable
// would be boxed on every draw, and spoil the allocation tests
export const seeded = (seed: number): (() => number) => {
	const state = new Uint32Array([seed]);
	return () => {
		state[0] = (state[0] ?? 0) + 0x6d2b79f5;
		let t = state[0] ?? 0;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
};
