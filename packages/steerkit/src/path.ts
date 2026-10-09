import type { Agent, Vec3 } from "./types.ts";
import { desire, set } from "./vec.ts";

export type FollowPathOptions = {
	/**
	 * The half-width of the path: within it, the agent goes its own way
	 * along the path, like a car on a road; beyond it, it steers back.
	 */
	radius: number;
	/**
	 * How far ahead to look, in seconds: where the agent will be is checked
	 * against the path, and the point it steers back to is that far along
	 * the path at `maxSpeed`. Keep it above 0, or a still agent never starts.
	 */
	lookAhead: number;
	/** Whether the last point leads back to the first: a loop. */
	closed?: boolean;
};

/**
 * Follows a path, from its first point to its last (Reynolds' path
 * following): `points` is a polyline, a plain array of vectors or what your
 * engine's curves sample. While the agent, `lookAhead` seconds from now,
 * stays within `radius` of the path and heads along it, it speeds up its own
 * way; otherwise it seeks a point further along the path. An open path ends
 * in an arrival on its last point. The nearest part of the path is the one
 * followed: where a path crosses itself, the agent may switch branches.
 */
export function followPath(
	agent: Agent,
	points: ArrayLike<Vec3>,
	{ radius, lookAhead, closed }: FollowPathOptions,
	out: Vec3,
): Vec3 {
	const n = points.length;
	if (n === 0) return set(out, 0, 0, 0);
	const p = agent.position;
	const v = agent.velocity;
	const vx = v.x;
	const vy = v.y;
	const vz = v.z;
	const s = agent.maxSpeed;
	const t = lookAhead > 0 ? lookAhead : 0;
	// Where the agent will be
	const fx = p.x + vx * t;
	const fy = p.y + vy * t;
	const fz = p.z + vz * t;
	const segments = n === 1 ? 0 : closed ? n : n - 1;

	// The point of the path nearest to it: on segment `best`, at `along`
	// (0 to 1) from its start. And the path's length, for loops
	let best = 0;
	let along = 0;
	let nearest = -1;
	let total = 0;
	for (let i = 0; i < segments; i++) {
		const a = points[i] as Vec3;
		const b = points[i + 1 === n ? 0 : i + 1] as Vec3;
		const abx = b.x - a.x;
		const aby = b.y - a.y;
		const abz = b.z - a.z;
		const ll = abx * abx + aby * aby + abz * abz;
		total += Math.sqrt(ll);
		let u =
			ll > 0
				? ((fx - a.x) * abx + (fy - a.y) * aby + (fz - a.z) * abz) / ll
				: 0;
		u = u > 0 ? (u < 1 ? u : 1) : 0;
		const dx = fx - (a.x + abx * u);
		const dy = fy - (a.y + aby * u);
		const dz = fz - (a.z + abz * u);
		const d = dx * dx + dy * dy + dz * dz;
		if (nearest < 0 || d < nearest) {
			nearest = d;
			best = i;
			along = u;
		}
	}

	// From there, the point `maxSpeed × lookAhead` further along the path,
	// or the end of an open path. A single point is its own end
	const last = points[n - 1] as Vec3;
	let tx = last.x;
	let ty = last.y;
	let tz = last.z;
	let end = segments === 0;
	let ahead = s * t;
	if (closed && total > 0 && ahead > total) ahead %= total;
	let i = best;
	let u = along;
	for (let k = 0; k <= segments && !end; k++) {
		const a = points[i] as Vec3;
		const b = points[i + 1 === n ? 0 : i + 1] as Vec3;
		const abx = b.x - a.x;
		const aby = b.y - a.y;
		const abz = b.z - a.z;
		const length = Math.sqrt(abx * abx + aby * aby + abz * abz);
		const left = length * (1 - u);
		if (ahead <= left) {
			const w = length > 0 ? u + ahead / length : 0;
			tx = a.x + abx * w;
			ty = a.y + aby * w;
			tz = a.z + abz * w;
			break;
		}
		ahead -= left;
		u = 0;
		i++;
		if (i === segments) {
			if (closed) i = 0;
			else end = true;
		}
	}

	const dx = tx - p.x;
	const dy = ty - p.y;
	const dz = tz - p.z;
	if (end) {
		// Arrive on the last point, slowing down over the look-ahead
		const slowing = s * t;
		const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
		const ramp = slowing > 0 && d < slowing ? d / slowing : 1;
		return desire(agent, dx, dy, dz, s * ramp, out);
	}
	// On the path and heading along it: its own way, at full speed
	const a = points[best] as Vec3;
	const b = points[best + 1 === n ? 0 : best + 1] as Vec3;
	const forward = vx * (b.x - a.x) + vy * (b.y - a.y) + vz * (b.z - a.z) > 0;
	if (forward && Math.sqrt(nearest) <= radius)
		return desire(agent, vx, vy, vz, s, out);
	return desire(agent, dx, dy, dz, s, out);
}
