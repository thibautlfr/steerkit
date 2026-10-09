// Behaviors that dodge what lies ahead: still obstacles (Reynolds' obstacle
// avoidance) and other movers (his unaligned collision avoidance). Both
// predict when the agent will pass closest to each thing and keep the
// soonest one it would hit: an obstacle is cleared by turning along its
// tangent, a mover by steering sideways, away from where they'd meet.

import type { Agent, Mover, Obstacle, Plane, Vec3 } from "./types.ts";
import { norm, set } from "./vec.ts";

const OBSTACLES = 0;
const COLLISIONS = 1;

// Both behaviors in one loop, `kind` choosing what each item is: a still
// obstacle with its own radius, or a mover as wide as the agent. The loop
// calls nothing: a helper V8 doesn't inline there would box numbers for
// every item
const avoid = (
	agent: Agent,
	items: ArrayLike<Obstacle | Mover>,
	kind: number,
	radius: number,
	lookAhead: number,
	plane: Plane | undefined,
	out: Vec3,
): Vec3 => {
	const p = agent.position;
	const v = agent.velocity;
	const vx = v.x;
	const vy = v.y;
	const vz = v.z;

	// The soonest threat: when, how close, and the agent's offset from it
	// then (rx ry rz), the way to steer. Its motion relative to the agent
	// (gx gy gz) picks a side when they'd meet dead on
	let found = false;
	let soonest = 0;
	let closest = 0;
	let rx = 0;
	let ry = 0;
	let rz = 0;
	let gx = 0;
	let gy = 0;
	let gz = 0;
	// Where it is now (bx by bz), how far, and its reach
	let bx = 0;
	let by = 0;
	let bz = 0;
	let far = 0;
	let reach = 0;
	for (let i = 0; i < items.length; i++) {
		const item = items[i] as Obstacle & Mover;
		const q = item.position;
		// The agent itself, recognized by its position object, as in a list
		// of the whole crowd
		if (q === p) continue;
		const r = kind === OBSTACLES ? item.radius + radius : 2 * radius;
		// The item seen from the agent, and how it moves relative to it
		const dx = q.x - p.x;
		const dy = q.y - p.y;
		const dz = q.z - p.z;
		const w = kind === OBSTACLES ? undefined : item.velocity;
		const wx = (w === undefined ? 0 : w.x) - vx;
		const wy = (w === undefined ? 0 : w.y) - vy;
		const wz = (w === undefined ? 0 : w.z) - vz;
		const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
		let t: number;
		let sx: number;
		let sy: number;
		let sz: number;
		if (d < r) {
			// Already within reach: the threat is now
			t = 0;
			sx = dx;
			sy = dy;
			sz = dz;
		} else {
			// The time of closest approach, and where the item is then
			const ww = wx * wx + wy * wy + wz * wz;
			if (!(ww > 0)) continue;
			t = -(dx * wx + dy * wy + dz * wz) / ww;
			// Written so that a NaN or negative lookAhead sees nothing ahead
			if (!(t > 0 && t <= lookAhead)) continue;
			sx = dx + wx * t;
			sy = dy + wy * t;
			sz = dz + wz * t;
		}
		const s = Math.sqrt(sx * sx + sy * sy + sz * sz);
		if (!(s < r)) continue;
		if (found && (t > soonest || (t === soonest && s >= closest))) continue;
		found = true;
		soonest = t;
		closest = s;
		rx = -sx;
		ry = -sy;
		rz = -sz;
		gx = -wx;
		gy = -wy;
		gz = -wz;
		bx = dx;
		by = dy;
		bz = dz;
		far = d;
		reach = r;
	}
	if (!found) return set(out, 0, 0, 0);

	// Away from the threat: at the closest approach, the offset is already
	// across the relative motion
	if (plane === "xy") rz = 0;
	else if (plane === "xz") ry = 0;
	else if (plane === "yz") rx = 0;
	let l = norm(rx, ry, rz);
	if (!(l > 1e-9 * (closest + 1))) {
		// Dead on: to the right of the relative motion, forward × up, up
		// being the plane's normal (+y without a plane), or × x when the
		// motion is straight up
		const ux = plane === "yz" ? 1 : 0;
		const uz = plane === "xy" ? 1 : 0;
		const uy = 1 - ux - uz;
		rx = gy * uz - gz * uy;
		ry = gz * ux - gx * uz;
		rz = gx * uy - gy * ux;
		l = norm(rx, ry, rz);
		if (!(l > 0)) {
			rx = 0;
			ry = gz;
			rz = -gy;
			l = norm(rx, ry, rz);
		}
		// Two things on the same spot, both still: no way is better
		if (!(l > 0)) return set(out, 0, 0, 0);
	}

	if (kind === OBSTACLES) {
		const s = agent.maxSpeed;
		// Inside the obstacle (within reach of it): straight out, full speed
		if (soonest === 0)
			return set(out, (rx / l) * s - vx, (ry / l) * s - vy, (rz / l) * s - vz);
		// Ahead: turn, at the same speed, along the tangent that just clears
		// it, in the plane of the obstacle's direction (u) and the way away
		// from it (n). The nearer, the wider the turn
		let ux = bx / far;
		let uy = by / far;
		let uz = bz / far;
		if (plane === "xy") uz = 0;
		else if (plane === "xz") uy = 0;
		else if (plane === "yz") ux = 0;
		const along = (rx * ux + ry * uy + rz * uz) / l;
		let nx = rx / l - along * ux;
		let ny = ry / l - along * uy;
		let nz = rz / l - along * uz;
		const nl = norm(nx, ny, nz);
		if (nl > 1e-9) {
			nx /= nl;
			ny /= nl;
			nz /= nl;
			const sin = reach / far;
			const cos = Math.sqrt(1 - sin * sin);
			const speed = norm(vx, vy, vz);
			return set(
				out,
				(ux * cos + nx * sin) * speed - vx,
				(uy * cos + ny * sin) * speed - vy,
				(uz * cos + nz * sin) * speed - vz,
			);
		}
	}

	// Sideways at up to maxSpeed, the sooner the harder, on top of the
	// velocity, the whole bounded by maxSpeed
	const urgency = lookAhead > 0 ? 1 - soonest / lookAhead : 1;
	const k = (agent.maxSpeed * urgency) / l;
	let ex = vx + rx * k;
	let ey = vy + ry * k;
	let ez = vz + rz * k;
	const e = norm(ex, ey, ez);
	if (e > agent.maxSpeed) {
		const c = agent.maxSpeed / e;
		ex *= c;
		ey *= c;
		ez *= c;
	}
	return set(out, ex - vx, ey - vy, ez - vz);
};

export type AvoidanceOptions = {
	/** The agent's own radius: how wide a berth it needs. */
	radius: number;
	/**
	 * How far ahead to look, in seconds: what the agent would meet within
	 * that time is avoided, the sooner the harder.
	 */
	lookAhead: number;
	/**
	 * The plane the agent moves in: `"xy"` for a 2D canvas, `"xz"` on the
	 * ground. Keeps the force in it, and its normal is up when the agent
	 * picks a side; without it, up is +y.
	 */
	plane?: Plane;
};

/**
 * Steers around the obstacles in the agent's way (Reynolds' obstacle
 * avoidance): of those it would hit within `lookAhead` seconds, given its
 * `radius`, the nearest makes it turn, at the same speed, toward the
 * direction that just clears it: the nearer, the wider the turn. Head-on,
 * it turns right (forward × up). Within reach of an obstacle, it steers
 * straight out at full speed. Zero force when the way is clear. Give it
 * more weight than a goal that pulls the agent into the obstacle (the
 * pointer behind a rock), or the two cancel out.
 */
export function avoidObstacles(
	agent: Agent,
	obstacles: ArrayLike<Obstacle>,
	{ radius, lookAhead, plane }: AvoidanceOptions,
	out: Vec3,
): Vec3 {
	return avoid(agent, obstacles, OBSTACLES, radius, lookAhead, plane, out);
}

/**
 * Steers clear of the other movers (Reynolds' unaligned collision
 * avoidance): for each, the moment they'd pass closest, if within
 * `lookAhead` seconds and closer than twice `radius`; the soonest is avoided
 * sideways, harder the sooner. Two agents heading for each other both turn
 * right, and pass. `others` is any list of movers: the whole crowd, the
 * agent itself included, which it ignores, or what a spatial grid returns.
 * Zero force when no one is in the way.
 */
export function avoidCollisions(
	agent: Agent,
	others: ArrayLike<Mover>,
	{ radius, lookAhead, plane }: AvoidanceOptions,
	out: Vec3,
): Vec3 {
	return avoid(agent, others, COLLISIONS, radius, lookAhead, plane, out);
}
