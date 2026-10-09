import type { Agent, FlowField, Vec3 } from "./types.ts";
import { norm, set } from "./vec.ts";

export type FollowFlowOptions = {
	/**
	 * How far ahead to read the flow, in seconds: where the agent will be,
	 * so it turns before the flow does. 0 reads it where the agent is.
	 */
	lookAhead: number;
};

/**
 * Goes with the flow (Reynolds' flow field following): the agent heads,
 * at full speed, the way `field` points where it will be in `lookAhead`
 * seconds. `field` is yours: a grid of vectors, a noise, a formula. Zero
 * force where the flow is null.
 */
export function followFlow(
	agent: Agent,
	field: FlowField,
	{ lookAhead }: FollowFlowOptions,
	out: Vec3,
): Vec3 {
	const p = agent.position;
	const v = agent.velocity;
	const vx = v.x;
	const vy = v.y;
	const vz = v.z;
	const t = lookAhead > 0 ? lookAhead : 0;
	// `out` holds the position to read the flow at, then the flow: all the
	// inputs are read by now, so it may be any of them
	set(out, p.x + vx * t, p.y + vy * t, p.z + vz * t);
	field(out, out);
	const fx = out.x;
	const fy = out.y;
	const fz = out.z;
	const l = norm(fx, fy, fz);
	if (!(l > 0)) return set(out, 0, 0, 0);
	const k = agent.maxSpeed / l;
	return set(out, fx * k - vx, fy * k - vy, fz * k - vz);
}
