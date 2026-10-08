// Combining forces. Each combinator comes in two forms: one call that reads
// best (`blend`, `prioritize`), which allocates the small arrays of its
// arguments, and its allocation-free twin built from `zero` and `add` or
// `addWithin`, for hundreds of agents.

import type { Term, Vec3 } from "./types.ts";
import { length, norm, set } from "./vec.ts";

/** Sets `out` to the zero vector, to start a sum. */
export function zero(out: Vec3): Vec3 {
	return set(out, 0, 0, 0);
}

/** Adds `force × weight` to `out`: the allocation-free form of {@link blend}. */
export function add(out: Vec3, force: Vec3, weight = 1): Vec3 {
	return set(
		out,
		out.x + force.x * weight,
		out.y + force.y * weight,
		out.z + force.z * weight,
	);
}

/**
 * Adds `force × weight` to `out`, but only what fits in what is left of
 * `budget`, a bound on the length of `out` (typically `agent.maxForce`).
 * Called in order of priority, the first forces take what they need and the
 * last get the rest, or nothing: the allocation-free form of
 * {@link prioritize}.
 */
export function addWithin(
	out: Vec3,
	budget: number,
	force: Vec3,
	weight = 1,
): Vec3 {
	const left = budget - length(out);
	const f = length(force) * Math.abs(weight);
	if (left <= 0 || f === 0) return out;
	return add(out, force, f > left ? (weight * left) / f : weight);
}

/** The weighted sum of the forces of `terms`. */
export function blend(out: Vec3, ...terms: Term[]): Vec3 {
	let x = 0;
	let y = 0;
	let z = 0;
	for (const [force, weight] of terms) {
		x += force.x * weight;
		y += force.y * weight;
		z += force.z * weight;
	}
	return set(out, x, y, z);
}

/**
 * Sums `forces` in order of priority within `budget` (typically
 * `agent.maxForce`): each one takes what it needs from what is left, the
 * last one is cut to the remainder, and the next ones get nothing. Unlike
 * {@link blend}, a lesser force can't cancel a more urgent one (Buckland's
 * "truncated running sum with prioritization").
 */
export function prioritize(out: Vec3, budget: number, ...forces: Vec3[]): Vec3 {
	// Summed apart from `out`, which may be one of `forces`
	let x = 0;
	let y = 0;
	let z = 0;
	for (const force of forces) {
		const left = budget - norm(x, y, z);
		if (left <= 0) break;
		const f = length(force);
		const k = f > left ? left / f : 1;
		x += force.x * k;
		y += force.y * k;
		z += force.z * k;
	}
	return set(out, x, y, z);
}
