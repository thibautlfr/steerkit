/**
 * Any `{ x, y, z }` object: plain literals, `THREE.Vector3`, or your engine's
 * own vectors all fit, by structural typing. For 2D, keep `z` at 0.
 */
export type Vec3 = { x: number; y: number; z: number };

/**
 * A steered character, as Reynolds models it: a point mass with a bounded
 * force and a bounded speed. Your own objects fit as long as they have these
 * fields.
 */
export type Agent = {
	position: Vec3;
	velocity: Vec3;
	/** Top speed, in units per second. */
	maxSpeed: number;
	/**
	 * Bound on the steering force, in units per second²: low turns like a
	 * ship, high like a fly.
	 */
	maxForce: number;
	/** A heavier agent responds slower to the same force. Must be > 0; 1 when not given. */
	mass?: number;
};

/** Something that moves, for the behaviors that predict where it will be. */
export type Mover = {
	position: Vec3;
	velocity: Vec3;
};

/** A steering force and its weight, for {@link blend}. */
export type Term = readonly [force: Vec3, weight: number];

/** A plane to keep a behavior in, for 2D canvases (`"xy"`) or ground characters (`"xz"`). */
export type Plane = "xy" | "xz" | "yz";

/**
 * A sphere (a circle in 2D) to steer around, for {@link avoidObstacles}. Its
 * `position` lets a spatial grid sort obstacles like a crowd.
 */
export type Obstacle = { position: Vec3; radius: number };
