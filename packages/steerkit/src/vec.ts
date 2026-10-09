// Internal helpers, not exported from the package: the public API stays
// behaviors and combinators, not yet another vector library.

import type { Agent, Plane, Vec3 } from "./types.ts";

export const set = (out: Vec3, x: number, y: number, z: number): Vec3 => {
	out.x = x;
	out.y = y;
	out.z = z;
	return out;
};

// Not Math.hypot: V8 allocates a temporary array for it when the call isn't
// optimized away, and its overflow safety is moot at the scale of a scene
export const norm = (x: number, y: number, z: number): number =>
	Math.sqrt(x * x + y * y + z * z);

export const length = (v: Vec3): number => norm(v.x, v.y, v.z);

export const distance = (a: Vec3, b: Vec3): number =>
	norm(a.x - b.x, a.y - b.y, a.z - b.z);

// Zeroes the component that leaves `plane`
export const flatten = (v: Vec3, plane: Plane | undefined): Vec3 => {
	if (plane === "xy") v.z = 0;
	else if (plane === "xz") v.y = 0;
	else if (plane === "yz") v.x = 0;
	return v;
};

// Scales `v` to length 1, or to `fallback` (x for the planes that have it,
// y otherwise) when it has no direction
export const normalize = (v: Vec3, plane: Plane | undefined): Vec3 => {
	const l = length(v);
	if (l > 1e-9) return set(v, v.x / l, v.y / l, v.z / l);
	return plane === "yz" ? set(v, 0, 1, 0) : set(v, 1, 0, 0);
};

// The heart of Reynolds' model: the force taking the agent to `speed` along
// (dx, dy, dz), i.e. `desired velocity − velocity`, or to a stop when that
// direction is null. Every component is read before `out` is written, so
// `out` may be any of the inputs.
export const desire = (
	agent: Agent,
	dx: number,
	dy: number,
	dz: number,
	speed: number,
	out: Vec3,
): Vec3 => {
	const l = norm(dx, dy, dz);
	const k = l === 0 ? 0 : speed / l;
	const v = agent.velocity;
	return set(out, dx * k - v.x, dy * k - v.y, dz * k - v.z);
};
