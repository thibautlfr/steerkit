// Behaviors that keep a place relative to a leader: a slot in a formation
// (offset pursuit) or a spot behind it (leader following). Both match the
// leader's velocity once in place, rather than stopping there and lagging
// behind.

import type { Agent, Mover, Plane, Vec3 } from "./types.ts";
import { norm, set } from "./vec.ts";

const OFFSET = 0;
const FOLLOW = 1;

// Both behaviors in one function, `kind` choosing where the agent heads
// for, all in locals: a helper V8 doesn't inline, or module scratch
// vectors, would box numbers on every call
const place = (
	agent: Agent,
	leader: Mover,
	kind: number,
	ahead: number,
	across: number,
	distance: number,
	slowingDistance: number,
	plane: Plane | undefined,
	out: Vec3,
): Vec3 => {
	const p = agent.position;
	const l = leader.position;
	const lv = leader.velocity;

	// The leader's heading, its velocity kept in `plane`
	let fx = plane === "yz" ? 0 : lv.x;
	let fy = plane === "xz" ? 0 : lv.y;
	let fz = plane === "xy" ? 0 : lv.z;
	const speed = norm(fx, fy, fz);
	const still = !(speed > 1e-9);
	if (still) {
		fx = 0;
		fy = 0;
		fz = 0;
	} else {
		fx /= speed;
		fy /= speed;
		fz /= speed;
	}

	// Its right side, forward × up, up being the plane's normal (+z for
	// "xy", +y for "xz", +x for "yz"), +y without a plane. None when the
	// leader is still or heads straight up
	const ux = plane === "yz" ? 1 : 0;
	const uz = plane === "xy" ? 1 : 0;
	const uy = 1 - ux - uz;
	let sx = fy * uz - fz * uy;
	let sy = fz * ux - fx * uz;
	let sz = fx * uy - fy * ux;
	const sl = norm(sx, sy, sz);
	if (sl > 1e-9) {
		sx /= sl;
		sy /= sl;
		sz /= sl;
	} else {
		sx = 0;
		sy = 0;
		sz = 0;
	}

	// Where the agent heads for
	let tx: number;
	let ty: number;
	let tz: number;
	if (kind === OFFSET) {
		// A still leader faces x (y in the yz plane), for want of a heading
		const hx = still ? (plane === "yz" ? 0 : 1) : fx;
		const hy = still ? (plane === "yz" ? 1 : 0) : fy;
		tx = l.x + hx * ahead + sx * across;
		ty = l.y + hy * ahead + sy * across;
		tz = l.z + fz * ahead + sz * across;
	} else {
		const rx = p.x - l.x;
		const ry = p.y - l.y;
		const rz = p.z - l.z;
		const along = rx * fx + ry * fy + rz * fz;
		const ax = rx - along * fx;
		const ay = ry - along * fy;
		const az = rz - along * fz;
		const off = norm(ax, ay, az);
		if (still) {
			// At `distance` from the leader, where the agent is
			const r = norm(rx, ry, rz);
			const k = r === 0 ? 0 : distance / r;
			tx = r === 0 ? p.x : l.x + rx * k;
			ty = r === 0 ? p.y : l.y + ry * k;
			tz = r === 0 ? p.z : l.z + rz * k;
		} else if (along > 0 && along < distance && off < distance) {
			// In the leader's way: away from its path, sideways. Dead on the
			// path, any side will do: the leader's right
			const k = off > 0 ? distance / off : distance;
			tx = p.x + (off > 0 ? ax : sx) * k;
			ty = p.y + (off > 0 ? ay : sy) * k;
			tz = p.z + (off > 0 ? az : sz) * k;
		} else {
			tx = l.x - fx * distance;
			ty = l.y - fy * distance;
			tz = l.z - fz * distance;
		}
	}

	// The leader's velocity plus a pull toward the target, at full speed
	// beyond `slowingDistance` and fading to nothing on it (as `arrive`),
	// the whole bounded by `maxSpeed`
	const dx = tx - p.x;
	const dy = ty - p.y;
	const dz = tz - p.z;
	const d = norm(dx, dy, dz);
	// No Infinity for "no ramp": that constant, mixed with the ramp, makes V8
	// box the number when it doesn't inline this function
	const ramp =
		slowingDistance > 0 && d < slowingDistance ? d / slowingDistance : 1;
	const k = d === 0 ? 0 : (agent.maxSpeed * ramp) / d;
	let wx = lv.x + dx * k;
	let wy = lv.y + dy * k;
	let wz = lv.z + dz * k;
	const w = norm(wx, wy, wz);
	if (w > agent.maxSpeed) {
		const s = agent.maxSpeed / w;
		wx *= s;
		wy *= s;
		wz *= s;
	}
	const v = agent.velocity;
	return set(out, wx - v.x, wy - v.y, wz - v.z);
};

export type OffsetPursuitOptions = {
	/** How far ahead of the leader the slot is (negative: behind). */
	ahead: number;
	/**
	 * How far to the side of the leader the slot is: to its right (forward ×
	 * up) when positive, to its left when negative. On a y-down 2D canvas,
	 * where up (+z) points into the screen, positive is the left on screen.
	 */
	side: number;
	/** Within this distance of its slot, the agent eases into it. */
	slowingDistance: number;
	/**
	 * The plane the leader moves in: `"xy"` for a 2D canvas, `"xz"` on the
	 * ground. Its normal is up; without it, up is +y.
	 */
	plane?: Plane;
};

/**
 * Keeps a slot relative to the leader, `ahead` along its heading and `side`
 * across it: a place in a formation (Reynolds' offset pursuit). Once in its
 * slot, the agent matches the leader's velocity. A still leader has no
 * heading: the slot is then `ahead` of it along x (y in the yz plane), as
 * if it faced that way.
 */
export function offsetPursuit(
	agent: Agent,
	leader: Mover,
	{ ahead, side, slowingDistance, plane }: OffsetPursuitOptions,
	out: Vec3,
): Vec3 {
	return place(
		agent,
		leader,
		OFFSET,
		ahead,
		side,
		0,
		slowingDistance,
		plane,
		out,
	);
}

export type FollowOptions = {
	/** How far behind the leader to follow. */
	distance: number;
	/** Within this distance of its spot, the agent eases into it. */
	slowingDistance: number;
	/** The plane the leader moves in, as for {@link offsetPursuit}. */
	plane?: Plane;
};

/**
 * Follows `distance` behind the leader, matching its velocity, and steps
 * aside when in its way: within `distance` ahead of the leader and of its
 * path (Reynolds' leader following). A still leader is kept at `distance`,
 * on the side the agent is. Add `separation` among the followers so they
 * don't pile up on the same spot.
 */
export function follow(
	agent: Agent,
	leader: Mover,
	{ distance, slowingDistance, plane }: FollowOptions,
	out: Vec3,
): Vec3 {
	return place(
		agent,
		leader,
		FOLLOW,
		0,
		0,
		distance,
		slowingDistance,
		plane,
		out,
	);
}
