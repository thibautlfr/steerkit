import type { Agent, Vec3 } from "./types.ts";
import { desire, distance, norm, set } from "./vec.ts";

/** Full speed toward `target`. */
export function seek(agent: Agent, target: Vec3, out: Vec3): Vec3 {
	const p = agent.position;
	return desire(
		agent,
		target.x - p.x,
		target.y - p.y,
		target.z - p.z,
		agent.maxSpeed,
		out,
	);
}

/** Full speed away from `from`. */
export function flee(agent: Agent, from: Vec3, out: Vec3): Vec3 {
	const p = agent.position;
	return desire(
		agent,
		p.x - from.x,
		p.y - from.y,
		p.z - from.z,
		agent.maxSpeed,
		out,
	);
}

/**
 * Seek that slows down within `slowingDistance` of `target`, to stop on it.
 * A `slowingDistance` ≤ 0 means no slowing down: plain seek.
 */
export function arrive(
	agent: Agent,
	target: Vec3,
	{ slowingDistance }: { slowingDistance: number },
	out: Vec3,
): Vec3 {
	const p = agent.position;
	const d = distance(p, target);
	// No Infinity for "no ramp": that constant, mixed with the ramp, makes V8
	// box the number when it doesn't inline this function
	const ramp =
		slowingDistance > 0 && d < slowingDistance ? d / slowingDistance : 1;
	return desire(
		agent,
		target.x - p.x,
		target.y - p.y,
		target.z - p.z,
		agent.maxSpeed * ramp,
		out,
	);
}

/**
 * Flee `from` only within `radius` of it, harder the closer the agent gets:
 * the force fades to 0 at the edge, so entering the zone doesn't jolt. A
 * personal space around a point. Zero force on the point itself, where no
 * direction is better than another.
 */
export function keepAway(
	agent: Agent,
	from: Vec3,
	{ radius }: { radius: number },
	out: Vec3,
): Vec3 {
	// Flee's force, scaled by k, all in locals: through flee, it would call
	// desire, too large for V8 to always inline, and once a big frame has
	// spent its inlining budget, that call boxes its four numbers
	const p = agent.position;
	const v = agent.velocity;
	const dx = p.x - from.x;
	const dy = p.y - from.y;
	const dz = p.z - from.z;
	const d = norm(dx, dy, dz);
	if (d >= radius || d === 0) return set(out, 0, 0, 0);
	const k = 1 - d / radius;
	const s = agent.maxSpeed / d;
	return set(out, (dx * s - v.x) * k, (dy * s - v.y) * k, (dz * s - v.z) * k);
}

/** Come to a stop: the force opposing the velocity. */
export function brake(agent: Agent, out: Vec3): Vec3 {
	const v = agent.velocity;
	return set(out, -v.x, -v.y, -v.z);
}
