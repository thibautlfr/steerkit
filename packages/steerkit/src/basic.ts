import type { Agent, Vec3 } from "./types.ts";
import { desire, distance, set } from "./vec.ts";

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
	const ramp =
		slowingDistance > 0 ? distance(p, target) / slowingDistance : Infinity;
	return desire(
		agent,
		target.x - p.x,
		target.y - p.y,
		target.z - p.z,
		agent.maxSpeed * Math.min(ramp, 1),
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
	const d = distance(agent.position, from);
	if (d >= radius || d === 0) return set(out, 0, 0, 0);
	flee(agent, from, out);
	const k = 1 - d / radius;
	return set(out, out.x * k, out.y * k, out.z * k);
}

/** Come to a stop: the force opposing the velocity. */
export function brake(agent: Agent, out: Vec3): Vec3 {
	const v = agent.velocity;
	return set(out, -v.x, -v.y, -v.z);
}
