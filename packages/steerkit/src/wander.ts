import type { Agent, Plane, Vec3 } from "./types.ts";
import { desire, flatten, norm, normalize } from "./vec.ts";

/**
 * The memory of {@link wander}, one per agent: where the wander point sits on
 * its circle, relative to the heading. Treat it as opaque.
 */
export type WanderState = {
	/** Unit direction from the circle's center to the wander point. */
	offset: Vec3;
	/** Unit heading at the last call, to carry `offset` along when the agent turns. */
	heading: Vec3;
	/** Uniform in [0, 1), `Math.random` by default. */
	random: () => number;
};

/**
 * Creates the state {@link wander} needs between frames. Pass a seeded
 * `random` for reproducible wandering (tests, recorded demos).
 */
export function createWanderState(
	random: () => number = Math.random,
): WanderState {
	const direction = (): Vec3 =>
		normalize(
			{ x: random() * 2 - 1, y: random() * 2 - 1, z: random() * 2 - 1 },
			undefined,
		);
	return { offset: direction(), heading: direction(), random };
}

export type WanderOptions = {
	/** Radius of the circle the wander point moves on: larger turns sharper. */
	radius: number;
	/** How far ahead of the agent that circle sits: larger turns smoother. */
	distance: number;
	/**
	 * How fast the wander point drifts: about `jitter` units over one second.
	 * The drift is a random walk scaled by √dt, so the wandering looks the same
	 * at any framerate.
	 */
	jitter: number;
	/**
	 * Keeps the wandering in a plane: `"xy"` for a 2D canvas, `"xz"` for a
	 * character on the ground. On a sphere, in all three axes, when not given.
	 */
	plane?: Plane;
};

/**
 * Reynolds' wander: seek a point on a circle (a sphere in 3D) ahead of the
 * agent, which drifts a little at random every frame. The heading thus
 * changes smoothly, in natural curves, instead of trembling. The point is
 * kept relative to the heading, so a point on the left keeps the agent
 * turning left until it drifts away.
 */
export function wander(
	agent: Agent,
	state: WanderState,
	{ radius, distance, jitter, plane }: WanderOptions,
	dt: number,
	out: Vec3,
): Vec3 {
	const { offset: o, heading: h, random } = state;

	// The heading follows the velocity; at a stop, the last one is kept
	const v = agent.velocity;
	let fx = v.x;
	let fy = plane === "xz" ? 0 : v.y;
	let fz = plane === "xy" ? 0 : v.z;
	if (plane === "yz") fx = 0;
	const speed = norm(fx, fy, fz);
	if (speed > 1e-9) {
		fx /= speed;
		fy /= speed;
		fz /= speed;
	} else {
		normalize(flatten(h, plane), plane);
		fx = h.x;
		fy = h.y;
		fz = h.z;
	}

	// Turns `offset` the way the heading turned since the last call
	// (Rodrigues' rotation taking h onto f, w = h × f): without this, the
	// point would stay fixed in world space and the agent would just line up
	// with it
	const cos = h.x * fx + h.y * fy + h.z * fz;
	if (cos > -0.999) {
		const wx = h.y * fz - h.z * fy;
		const wy = h.z * fx - h.x * fz;
		const wz = h.x * fy - h.y * fx;
		// w × o, then w × (w × o)
		const ax = wy * o.z - wz * o.y;
		const ay = wz * o.x - wx * o.z;
		const az = wx * o.y - wy * o.x;
		const bx = wy * az - wz * ay;
		const by = wz * ax - wx * az;
		const bz = wx * ay - wy * ax;
		const k = 1 / (1 + cos);
		o.x += ax + bx * k;
		o.y += ay + by * k;
		o.z += az + bz * k;
	}
	h.x = fx;
	h.y = fy;
	h.z = fz;

	// The random walk, as an angle on the unit circle: `jitter` units of arc
	// on a circle of `radius`
	const step = radius > 0 ? (jitter * Math.sqrt(dt)) / radius : 0;
	o.x += (random() * 2 - 1) * step;
	o.y += (random() * 2 - 1) * step;
	o.z += (random() * 2 - 1) * step;
	normalize(flatten(o, plane), plane);

	return desire(
		agent,
		fx * distance + o.x * radius,
		fy * distance + o.y * radius,
		fz * distance + o.z * radius,
		agent.maxSpeed,
		out,
	);
}
