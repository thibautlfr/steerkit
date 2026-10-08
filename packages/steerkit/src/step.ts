import type { Agent, Vec3 } from "./types.ts";
import { length, norm, set } from "./vec.ts";

export type StepOptions = {
	/**
	 * Softens the speed limit, in seconds. By default the speed is cut to
	 * `maxSpeed` at once, Reynolds' way: when `maxSpeed` drops (the end of a
	 * speed boost), the agent loses all its extra momentum in one frame. With
	 * this time constant, the extra speed fades out instead, by e^(−dt/τ) per
	 * step, so the same at any framerate. The force can still turn the agent
	 * meanwhile, just not speed it up past the fading limit.
	 */
	overspeedDamping?: number;
};

/**
 * Moves the agent under `force` for `dt` seconds: the force is bounded by
 * `maxForce` and divided by the mass, the velocity follows it and is bounded
 * by `maxSpeed`, and the position follows the velocity. `force` is left
 * untouched. Clamp `dt` on your side if frames can be long (a tab in the
 * background).
 */
export function step(
	agent: Agent,
	force: Vec3,
	dt: number,
	options?: StepOptions,
): void {
	const { position: p, velocity: v, maxSpeed } = agent;

	// The limit, read before the force speeds the agent up: above maxSpeed,
	// a soft limit decays from the current speed toward it
	const damping = options?.overspeedDamping ?? 0;
	const previous = length(v);
	const limit =
		damping > 0 && previous > maxSpeed
			? maxSpeed + (previous - maxSpeed) * Math.exp(-dt / damping)
			: maxSpeed;

	const f = length(force);
	const k =
		((f > agent.maxForce ? agent.maxForce / f : 1) / (agent.mass ?? 1)) * dt;
	let vx = v.x + force.x * k;
	let vy = v.y + force.y * k;
	let vz = v.z + force.z * k;

	const speed = norm(vx, vy, vz);
	if (speed > limit) {
		const s = limit / speed;
		vx *= s;
		vy *= s;
		vz *= s;
	}
	set(v, vx, vy, vz);
	set(p, p.x + vx * dt, p.y + vy * dt, p.z + vz * dt);
}
