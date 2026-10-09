import type { Agent, Bounds, Vec3 } from "./types.ts";
import { norm, set } from "./vec.ts";

export type StayWithinOptions = {
	/** How far inside the box's walls the agent turns back. */
	margin: number;
	/**
	 * How far ahead to look, in seconds: the agent turns back when it would
	 * cross the margin within that time.
	 */
	lookAhead: number;
};

/**
 * Keeps the agent inside a box (Reynolds' containment): when, `lookAhead`
 * seconds from now, it would be past `margin` from a wall, it turns back
 * toward the inside at full speed, the velocity along the other walls kept.
 * Zero force while it stays clear of the walls. In 2D, give the box no
 * depth (`min.z = max.z = 0`). A box narrower than twice the margin keeps
 * the agent on its middle.
 */
export function stayWithin(
	agent: Agent,
	{ min, max }: Bounds,
	{ margin, lookAhead }: StayWithinOptions,
	out: Vec3,
): Vec3 {
	const p = agent.position;
	const v = agent.velocity;
	const vx = v.x;
	const vy = v.y;
	const vz = v.z;
	const t = lookAhead > 0 ? lookAhead : 0;
	const m = margin > 0 ? margin : 0;

	// Per axis, the room left inside the margins, its middle when there's
	// none, and the desired velocity: back in at full speed when the agent
	// would be out, as it is otherwise
	let lo = min.x + m;
	let hi = max.x - m;
	if (lo > hi) lo = hi = (min.x + max.x) / 2;
	let f = p.x + vx * t;
	const ex = f < lo ? 1 : f > hi ? -1 : 0;
	lo = min.y + m;
	hi = max.y - m;
	if (lo > hi) lo = hi = (min.y + max.y) / 2;
	f = p.y + vy * t;
	const ey = f < lo ? 1 : f > hi ? -1 : 0;
	lo = min.z + m;
	hi = max.z - m;
	if (lo > hi) lo = hi = (min.z + max.z) / 2;
	f = p.z + vz * t;
	const ez = f < lo ? 1 : f > hi ? -1 : 0;
	if (ex === 0 && ey === 0 && ez === 0) return set(out, 0, 0, 0);

	// Turned back, then brought to maxSpeed
	const s = agent.maxSpeed;
	const dx = ex === 0 ? vx : ex * s;
	const dy = ey === 0 ? vy : ey * s;
	const dz = ez === 0 ? vz : ez * s;
	const l = norm(dx, dy, dz);
	const k = l > 0 ? s / l : 0;
	return set(out, dx * k - vx, dy * k - vy, dz * k - vz);
}
