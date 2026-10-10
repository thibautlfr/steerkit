// Reynolds' group behaviors (boids, SIGGRAPH 1987): each agent reacts to the
// neighbors it sees, within a radius and a field of view. The neighbors are
// any list of movers: the whole crowd for a few dozen agents, or what a
// spatial grid returns for more.

import type { Agent, Mover, Vec3 } from "./types.ts";
import { desire, norm, set } from "./vec.ts";

export type NeighborhoodOptions = {
	/** Neighbors farther than this are ignored. */
	radius: number;
	/**
	 * The full angle the agent sees, in radians, centered on its velocity:
	 * neighbors behind it are ignored. All around (2π) when not given, and at
	 * a stop, where the agent has no heading.
	 */
	fieldOfView?: number;
};

const SEPARATION = 0;
const COHESION = 1;
const ALIGNMENT = 2;

// The three behaviors in one loop, `kind` choosing what it sums. The loop
// over the neighbors calls nothing: a helper V8 doesn't inline there (its
// inlining budget runs out in a large frame) would box numbers for every
// neighbor
const react = (
	agent: Agent,
	neighbors: ArrayLike<Mover>,
	radius: number,
	fieldOfView: number | undefined,
	kind: number,
	out: Vec3,
): Vec3 => {
	const p = agent.position;
	const v = agent.velocity;
	const speed = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
	// A neighbor is seen when the cosine of its angle to the heading is at
	// least this: −1 sees all around
	const minCos =
		fieldOfView === undefined || fieldOfView >= 2 * Math.PI
			? -1
			: Math.cos(Math.max(fieldOfView, 0) / 2);
	let count = 0;
	// How close the nearest neighbor is, 1 − d / radius, for separation's
	// falloff. Not the distance itself: started at radius, a parameter, V8
	// boxed it
	let closest = 0;
	let x = 0;
	let y = 0;
	let z = 0;
	for (let i = 0; i < neighbors.length; i++) {
		const other = neighbors[i] as Mover;
		const q = other.position;
		// The agent itself, recognized by its position object: a list of the
		// whole crowd, or an agent lending its mesh's position, is fine
		if (q === p) continue;
		const dx = q.x - p.x;
		const dy = q.y - p.y;
		const dz = q.z - p.z;
		const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
		// Written so that a NaN radius sees no one
		if (!(d <= radius)) continue;
		if (
			minCos > -1 &&
			speed > 0 &&
			d > 0 &&
			(v.x * dx + v.y * dy + v.z * dz) / (speed * d) < minCos
		)
			continue;
		if (kind === SEPARATION) {
			// On the same spot, no direction is better than another
			if (d === 0) continue;
			// The unit direction away, then over d: never squares a tiny distance
			count++;
			const closeness = 1 - d / radius;
			if (closeness > closest) closest = closeness;
			x -= dx / d / d;
			y -= dy / d / d;
			z -= dz / d / d;
		} else {
			// A running mean, which can't overflow on far positions
			const w = kind === COHESION ? q : other.velocity;
			count++;
			x += (w.x - x) / count;
			y += (w.y - y) / count;
			z += (w.z - z) / count;
		}
	}
	if (count === 0 || (x === 0 && y === 0 && z === 0 && kind === SEPARATION))
		return set(out, 0, 0, 0);
	if (kind === COHESION) {
		// A pull toward the center, maxSpeed at the radius. The offset over
		// the radius is at most 1, the center of neighbors within the radius
		// being within it too: divided first, it stays finite for any radius
		if (!(radius > 0)) return set(out, 0, 0, 0);
		const s = agent.maxSpeed;
		return set(
			out,
			((x - p.x) / radius) * s,
			((y - p.y) / radius) * s,
			((z - p.z) / radius) * s,
		);
	}
	if (kind === SEPARATION) {
		// Flee's force, scaled as keepAway scales it, in locals: through
		// desire, V8 would box its numbers once a large frame has spent its
		// inlining budget
		const l = norm(x, y, z);
		const s = l > 0 ? agent.maxSpeed / l : 0;
		const k = closest;
		return set(out, (x * s - v.x) * k, (y * s - v.y) * k, (z * s - v.z) * k);
	}
	return desire(agent, x, y, z, Math.min(norm(x, y, z), agent.maxSpeed), out);
};

/**
 * Steer away from the neighbors, harder from the nearest: each one pushes
 * along the line between them, weighted by 1/distance, and the agent flees
 * the sum, as keepAway flees a point: harder the closer the nearest one,
 * fading to nothing at `radius`, so a neighbor coming into sight doesn't
 * jolt. Zero force when no neighbor is in sight.
 */
export function separation(
	agent: Agent,
	neighbors: ArrayLike<Mover>,
	{ radius, fieldOfView }: NeighborhoodOptions,
	out: Vec3,
): Vec3 {
	return react(agent, neighbors, radius, fieldOfView, SEPARATION, out);
}

/**
 * Steer toward the center of the neighbors, harder the farther it is: none
 * on the center itself, `maxSpeed` at `radius`. What keeps a flock
 * together. A pull rather than a seek, as in Reynolds' original boids: it
 * neither overshoots the center nor slows the agent down, so groups travel
 * instead of circling it. Zero force when no neighbor is in sight.
 */
export function cohesion(
	agent: Agent,
	neighbors: ArrayLike<Mover>,
	{ radius, fieldOfView }: NeighborhoodOptions,
	out: Vec3,
): Vec3 {
	return react(agent, neighbors, radius, fieldOfView, COHESION, out);
}

/**
 * Steer toward the average velocity of the neighbors (capped at
 * `maxSpeed`): what makes a flock fly the same way. Zero force when no
 * neighbor is in sight.
 */
export function alignment(
	agent: Agent,
	neighbors: ArrayLike<Mover>,
	{ radius, fieldOfView }: NeighborhoodOptions,
	out: Vec3,
): Vec3 {
	return react(agent, neighbors, radius, fieldOfView, ALIGNMENT, out);
}
