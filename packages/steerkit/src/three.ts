/**
 * The optional Three.js adapter, `steerkit/three`: it needs `three`
 * installed. steerkit moves points; this turns models to face their
 * velocity, draws a crowd in one call, and draws the forces for debugging.
 * The convention is three's own: a model faces its +z axis.
 *
 * @packageDocumentation
 */

import {
	BufferAttribute,
	BufferGeometry,
	Color,
	type ColorRepresentation,
	DynamicDrawUsage,
	type InstancedMesh,
	LineBasicMaterial,
	LineSegments,
	type Object3D,
} from "three";
import type { Bounds, Mover, Plane, Vec3 } from "./types.ts";
import { norm } from "./vec.ts";

export type FaceVelocityOptions = {
	/**
	 * How fast the object turns, per second: the angle left to turn shrinks
	 * by e^(−turnRate × dt) on every call, so the same at any framerate.
	 * 8 when not given; `Infinity` faces the velocity at once.
	 */
	turnRate?: number;
	/**
	 * Below this speed the velocity has no reliable direction, and the
	 * object keeps its orientation. 0.001 when not given.
	 */
	minSpeed?: number;
};

/**
 * Turns `object` toward `velocity`, its +z axis forward and upright along
 * `object.up`: what `object.lookAt` does, smoothed over time. `velocity` is
 * in the space of the object's parent, like its `position`: an agent's own
 * velocity when the object sits in the scene. Allocates nothing.
 */
export function faceVelocity(
	object: Pick<Object3D, "quaternion" | "up">,
	velocity: Vec3,
	dt: number,
	options?: FaceVelocityOptions,
): void {
	const rate = options?.turnRate ?? 8;
	const min = options?.minSpeed ?? 1e-3;
	if (!(dt > 0) || !(rate > 0)) return;
	const vx = velocity.x;
	const vy = velocity.y;
	const vz = velocity.z;
	const speed = norm(vx, vy, vz);
	if (!(speed > min && speed > 0 && speed <= Number.MAX_VALUE)) return;

	// The heading, normalized twice: below 1e-154 the speed itself is only
	// approximate
	let zx = vx / speed;
	let zy = vy / speed;
	let zz = vz / speed;
	let l = norm(zx, zy, zz);
	zx /= l;
	zy /= l;
	zz /= l;

	// Up, +y when it has no direction
	const u = object.up;
	let ux = u.x;
	let uy = u.y;
	let uz = u.z;
	l = norm(ux, uy, uz);
	if (l > 0 && l <= Number.MAX_VALUE) {
		ux /= l;
		uy /= l;
		uz /= l;
	} else {
		ux = 0;
		uy = 1;
		uz = 0;
	}

	// The basis lookAt builds: right = up × forward. Straight along up,
	// right is up × z, or up × x when up is near z: three's own choice
	let xx = uy * zz - uz * zy;
	let xy = uz * zx - ux * zz;
	let xz = ux * zy - uy * zx;
	l = norm(xx, xy, xz);
	if (!(l > 1e-6)) {
		if (uz < 0.9 && uz > -0.9) {
			xx = uy;
			xy = -ux;
			xz = 0;
		} else {
			xx = 0;
			xy = uz;
			xz = -uy;
		}
		// Square with the heading, only nearly along up
		const d = xx * zx + xy * zy + xz * zz;
		xx -= d * zx;
		xy -= d * zy;
		xz -= d * zz;
		l = norm(xx, xy, xz);
	}
	xx /= l;
	xy /= l;
	xz /= l;
	const yx = zy * xz - zz * xy;
	const yy = zz * xx - zx * xz;
	const yz = zx * xy - zy * xx;

	// The quaternion of that rotation (Quaternion.setFromRotationMatrix),
	// the basis being its columns
	let tx: number;
	let ty: number;
	let tz: number;
	let tw: number;
	const trace = xx + yy + zz;
	if (trace > 0) {
		const s = 0.5 / Math.sqrt(trace + 1);
		tw = 0.25 / s;
		tx = (yz - zy) * s;
		ty = (zx - xz) * s;
		tz = (xy - yx) * s;
	} else if (xx > yy && xx > zz) {
		const s = 2 * Math.sqrt(1 + xx - yy - zz);
		tw = (yz - zy) / s;
		tx = 0.25 * s;
		ty = (yx + xy) / s;
		tz = (zx + xz) / s;
	} else if (yy > zz) {
		const s = 2 * Math.sqrt(1 + yy - xx - zz);
		tw = (zx - xz) / s;
		tx = (yx + xy) / s;
		ty = 0.25 * s;
		tz = (zy + yz) / s;
	} else {
		const s = 2 * Math.sqrt(1 + zz - xx - yy);
		tw = (xy - yx) / s;
		tx = (zx + xz) / s;
		ty = (zy + yz) / s;
		tz = 0.25 * s;
	}

	const q = object.quaternion;
	if (rate === Number.POSITIVE_INFINITY) {
		q.set(tx, ty, tz, tw);
		return;
	}

	// A slerp, not a lerp: it leaves exactly (1 − k) of the angle, which is
	// what makes the turn independent of the framerate
	const k = 1 - Math.exp(-rate * dt);
	const qx = q.x;
	const qy = q.y;
	const qz = q.z;
	const qw = q.w;
	let cos = qx * tx + qy * ty + qz * tz + qw * tw;
	if (cos < 0) {
		tx = -tx;
		ty = -ty;
		tz = -tz;
		tw = -tw;
		cos = -cos;
	}
	if (cos >= 1) return;
	let a = 1 - k;
	let b = k;
	const sin2 = 1 - cos * cos;
	if (sin2 > Number.EPSILON) {
		const sin = Math.sqrt(sin2);
		const half = Math.atan2(sin, cos);
		a = Math.sin(a * half) / sin;
		b = Math.sin(b * half) / sin;
	}
	const x = qx * a + tx * b;
	const y = qy * a + ty * b;
	const z = qz * a + tz * b;
	const w = qw * a + tw * b;
	l = Math.sqrt(x * x + y * y + z * z + w * w);
	q.set(x / l, y / l, z / l, w / l);
}

export type SetInstancesOptions = {
	/** Keeps the instances upright along this direction: +y when not given. */
	up?: Vec3;
	/**
	 * Below this speed an instance keeps the orientation it had. 0.001 when
	 * not given.
	 */
	minSpeed?: number;
};

/**
 * Draws a crowd in one call: writes each agent's position, and an
 * orientation facing its velocity (+z forward, upright along `up`), into
 * the matrices of an `InstancedMesh`, then sets its `count`. Agents beyond
 * the mesh's capacity are left out. At a stop, an instance keeps the
 * orientation it had: +z on a new mesh. Scale the geometry itself, if need
 * be. The instances live in the mesh's space: keep the mesh at the origin
 * of the agents' space. three doesn't update the bounds of instances: set
 * `mesh.frustumCulled = false`. Allocates nothing.
 */
export function setInstances(
	mesh: Pick<InstancedMesh, "instanceMatrix" | "count">,
	agents: ArrayLike<Mover>,
	options?: SetInstancesOptions,
): void {
	const matrix = mesh.instanceMatrix;
	const m = matrix.array;
	const n = agents.length < matrix.count ? agents.length : matrix.count;
	const min = options?.minSpeed ?? 1e-3;
	const u = options?.up;
	let ux = u ? u.x : 0;
	let uy = u ? u.y : 1;
	let uz = u ? u.z : 0;
	const l = norm(ux, uy, uz);
	if (l > 0 && l <= Number.MAX_VALUE) {
		ux /= l;
		uy /= l;
		uz /= l;
	} else {
		ux = 0;
		uy = 1;
		uz = 0;
	}

	// The loop calls nothing but norm: the basis is faceVelocity's, inlined,
	// as a helper V8 doesn't inline would box numbers for every agent. At a
	// stop, the rotation is left as it is: rebuilding it from the matrix
	// made V8 box a number per agent
	for (let i = 0; i < n; i++) {
		const agent = agents[i] as Mover;
		const p = agent.position;
		const v = agent.velocity;
		// Column-major, as three stores matrices: right, up, forward, then
		// the position. The last row stays the mesh's 0, 0, 0, 1
		const o = i * 16;
		m[o + 12] = p.x;
		m[o + 13] = p.y;
		m[o + 14] = p.z;

		const vx = v.x;
		const vy = v.y;
		const vz = v.z;
		const speed = norm(vx, vy, vz);
		if (!(speed > min && speed > 0 && speed <= Number.MAX_VALUE)) continue;
		let zx = vx / speed;
		let zy = vy / speed;
		let zz = vz / speed;
		const z = norm(zx, zy, zz);
		zx /= z;
		zy /= z;
		zz /= z;

		let xx = uy * zz - uz * zy;
		let xy = uz * zx - ux * zz;
		let xz = ux * zy - uy * zx;
		let x = norm(xx, xy, xz);
		if (!(x > 1e-6)) {
			if (uz < 0.9 && uz > -0.9) {
				xx = uy;
				xy = -ux;
				xz = 0;
			} else {
				xx = 0;
				xy = uz;
				xz = -uy;
			}
			const d = xx * zx + xy * zy + xz * zz;
			xx -= d * zx;
			xy -= d * zy;
			xz -= d * zz;
			x = norm(xx, xy, xz);
		}
		xx /= x;
		xy /= x;
		xz /= x;

		m[o] = xx;
		m[o + 1] = xy;
		m[o + 2] = xz;
		m[o + 4] = zy * xz - zz * xy;
		m[o + 5] = zz * xx - zx * xz;
		m[o + 6] = zx * xy - zy * xx;
		m[o + 8] = zx;
		m[o + 9] = zy;
		m[o + 10] = zz;
	}
	mesh.count = n;
	matrix.needsUpdate = true;
}

export type SteeringHelperOptions = {
	/**
	 * How many line segments the helper holds. A shape that doesn't fit is
	 * left out whole. 4096 when not given: Reynolds' diagram takes 19, a box
	 * 12, a circle 32 and a sphere 96.
	 */
	capacity?: number;
	/**
	 * The vectors are drawn as far as the agent would go in this many
	 * seconds. 0.6 when not given, as in the demos.
	 */
	seconds?: number;
	/** The length of an arrowhead, at most half the arrow. 0.1 when not given. */
	headLength?: number;
	/** The colors, those of the demos when not given. */
	colors?: Partial<Record<keyof SteeringColors, ColorRepresentation>>;
};

/** The helper's colors, live: `.set()` one to change it. */
export type SteeringColors = {
	velocity: Color;
	desired: Color;
	steering: Color;
	/** Circles, spheres, boxes and paths, unless given their own. */
	shape: Color;
};

// Segments per circle
const SEGMENTS = 32;
// Dashes along the desired velocity
const DASHES = 5;
// An arrowhead's spread: tan(0.45 rad), as in the 2D demos
const SPREAD = 0.48;

/**
 * Draws steering for debugging, in one draw call: Reynolds' diagram of an
 * agent, and circles, spheres, boxes and paths for zones, obstacles, walls
 * and roads. Immediate mode: `reset()`, then draw, every frame. Coordinates
 * are those of the helper's parent, the scene usually. Lines are a pixel
 * wide (WebGL's limit); set `material.depthTest = false` to draw them
 * through meshes. Allocates nothing once built.
 */
export class SteeringHelper extends LineSegments<
	BufferGeometry,
	LineBasicMaterial
> {
	override readonly type: string = "SteeringHelper";
	readonly colors: SteeringColors;
	/** How far ahead the vectors are drawn, in seconds. */
	seconds: number;
	/** The length of an arrowhead. */
	headLength: number;
	private readonly capacity: number;
	private readonly vertices: Float32Array;
	private readonly tints: Float32Array;
	private readonly positionAttribute: BufferAttribute;
	private readonly colorAttribute: BufferAttribute;
	// Vertices drawn so far, two per segment
	private used = 0;

	constructor(options: SteeringHelperOptions = {}) {
		const capacity = Math.max(0, Math.floor(options.capacity ?? 4096));
		const vertices = new Float32Array(capacity * 6);
		const tints = new Float32Array(capacity * 6);
		const positionAttribute = new BufferAttribute(vertices, 3);
		const colorAttribute = new BufferAttribute(tints, 3);
		positionAttribute.setUsage(DynamicDrawUsage);
		colorAttribute.setUsage(DynamicDrawUsage);
		const geometry = new BufferGeometry();
		geometry.setAttribute("position", positionAttribute);
		geometry.setAttribute("color", colorAttribute);
		geometry.setDrawRange(0, 0);
		super(geometry, new LineBasicMaterial({ vertexColors: true }));
		// Its bounds change every frame
		this.frustumCulled = false;
		this.capacity = capacity;
		this.vertices = vertices;
		this.tints = tints;
		this.positionAttribute = positionAttribute;
		this.colorAttribute = colorAttribute;
		this.seconds = options.seconds ?? 0.6;
		this.headLength = options.headLength ?? 0.1;
		const colors = options.colors ?? {};
		this.colors = {
			velocity: new Color(colors.velocity ?? 0x2f6fde),
			desired: new Color(colors.desired ?? 0x1f9d6b),
			steering: new Color(colors.steering ?? 0xe0582b),
			shape: new Color(colors.shape ?? 0x5f6470),
		};
	}

	/**
	 * Erases what was drawn, before drawing the next frame. (Not `clear`,
	 * which three's objects use to remove their children.)
	 */
	reset(): void {
		this.used = 0;
		this.commit();
	}

	/**
	 * Reynolds' diagram, as in the demos: the velocity (blue), the desired
	 * velocity, `velocity + force` (green, dashed), and the steering force
	 * between their tips (orange). `force` is the one handed to `step`.
	 */
	vectors(agent: Mover, force: Vec3): void {
		const { position: p, velocity: v } = agent;
		const t = this.seconds;
		const px = p.x;
		const py = p.y;
		const pz = p.z;
		const vx = px + v.x * t;
		const vy = py + v.y * t;
		const vz = pz + v.z * t;
		const dx = vx + force.x * t;
		const dy = vy + force.y * t;
		const dz = vz + force.z * t;
		const out = this.vertices;

		// Behind the others, the desired velocity, in dashes as long as the
		// gaps between them. An arrow too short to see, or not finite, is
		// left out
		let l = norm(dx - px, dy - py, dz - pz);
		let at = l > 1e-6 && l <= Number.MAX_VALUE ? this.room(DASHES + 4) : -1;
		if (at >= 0) {
			for (let i = 0; i < DASHES; i++) {
				const a = (2 * i) / (2 * DASHES - 1);
				const b = (2 * i + 1) / (2 * DASHES - 1);
				const o = (at + 2 * i) * 3;
				out[o] = px + (dx - px) * a;
				out[o + 1] = py + (dy - py) * a;
				out[o + 2] = pz + (dz - pz) * a;
				out[o + 3] = px + (dx - px) * b;
				out[o + 4] = py + (dy - py) * b;
				out[o + 5] = pz + (dz - pz) * b;
			}
			this.head(at, at + 2 * DASHES - 1, at + 2 * DASHES);
			this.paint(at, at + 2 * (DASHES + 4), this.colors.desired);
		}

		l = norm(vx - px, vy - py, vz - pz);
		at = l > 1e-6 && l <= Number.MAX_VALUE ? this.room(5) : -1;
		if (at >= 0) {
			const o = at * 3;
			out[o] = px;
			out[o + 1] = py;
			out[o + 2] = pz;
			out[o + 3] = vx;
			out[o + 4] = vy;
			out[o + 5] = vz;
			this.head(at, at + 1, at + 2);
			this.paint(at, at + 10, this.colors.velocity);
		}

		l = norm(dx - vx, dy - vy, dz - vz);
		at = l > 1e-6 && l <= Number.MAX_VALUE ? this.room(5) : -1;
		if (at >= 0) {
			const o = at * 3;
			out[o] = vx;
			out[o + 1] = vy;
			out[o + 2] = vz;
			out[o + 3] = dx;
			out[o + 4] = dy;
			out[o + 5] = dz;
			this.head(at, at + 1, at + 2);
			this.paint(at, at + 10, this.colors.steering);
		}
		this.commit();
	}

	/**
	 * A circle in `plane` (`"xz"`, on the ground, when not given): a
	 * keepAway radius, a slowing distance, a 2D obstacle.
	 */
	circle(
		center: Vec3,
		radius: number,
		plane: Plane = "xz",
		color: Color = this.colors.shape,
	): void {
		const ring = plane === "xy" ? 0 : plane === "xz" ? 1 : 2;
		this.rings(center, radius, ring, ring + 1, color);
	}

	/** A sphere, as three circles: an obstacle, a zone in 3D. */
	sphere(center: Vec3, radius: number, color: Color = this.colors.shape): void {
		this.rings(center, radius, 0, 3, color);
	}

	/** The edges of a box: `THREE.Box3` as is, the bounds of `stayWithin`. */
	box({ min, max }: Bounds, color: Color = this.colors.shape): void {
		const at = this.room(12);
		if (at < 0) return;
		const out = this.vertices;
		let o = at * 3;
		// Each edge joins two corners differing on one axis: corner c takes
		// max on the axes of its bits (x 1, y 2, z 4)
		for (let c = 0; c < 8; c++) {
			for (let bit = 1; bit < 8; bit <<= 1) {
				if (c & bit) continue;
				const d = c | bit;
				out[o] = c & 1 ? max.x : min.x;
				out[o + 1] = c & 2 ? max.y : min.y;
				out[o + 2] = c & 4 ? max.z : min.z;
				out[o + 3] = d & 1 ? max.x : min.x;
				out[o + 4] = d & 2 ? max.y : min.y;
				out[o + 5] = d & 4 ? max.z : min.z;
				o += 6;
			}
		}
		this.paint(at, at + 24, color);
		this.commit();
	}

	/** A polyline, `closed` for a loop: the points of `followPath`. */
	path(
		points: ArrayLike<Vec3>,
		closed = false,
		color: Color = this.colors.shape,
	): void {
		const n = points.length;
		if (n < 2) return;
		const segments = closed ? n : n - 1;
		const at = this.room(segments);
		if (at < 0) return;
		const out = this.vertices;
		for (let i = 0; i < segments; i++) {
			const a = points[i] as Vec3;
			const b = points[i + 1 < n ? i + 1 : 0] as Vec3;
			const o = (at + 2 * i) * 3;
			out[o] = a.x;
			out[o + 1] = a.y;
			out[o + 2] = a.z;
			out[o + 3] = b.x;
			out[o + 4] = b.y;
			out[o + 5] = b.z;
		}
		this.paint(at, at + 2 * segments, color);
		this.commit();
	}

	/** Frees the geometry and the material, once the helper is removed. */
	dispose(): void {
		this.geometry.dispose();
		this.material.dispose();
	}

	// None of the private methods takes a fractional number: V8 would box it
	// on every call it doesn't inline. They pass vertex indices, and read the
	// coordinates back from the buffer.

	// Rings in the planes first to last − 1 (xy, xz, yz)
	private rings(
		center: Vec3,
		radius: number,
		first: number,
		last: number,
		color: Color,
	): void {
		const at = this.room((last - first) * SEGMENTS);
		if (at < 0) return;
		const r = radius > 0 && radius <= Number.MAX_VALUE ? radius : 0;
		const cx = center.x;
		const cy = center.y;
		const cz = center.z;
		const out = this.vertices;
		let o = at * 3;
		for (let ring = first; ring < last; ring++) {
			for (let i = 0; i < SEGMENTS; i++) {
				const a0 = (2 * Math.PI * i) / SEGMENTS;
				const a1 = (2 * Math.PI * (i + 1)) / SEGMENTS;
				const c0 = r * Math.cos(a0);
				const s0 = r * Math.sin(a0);
				const c1 = r * Math.cos(a1);
				const s1 = r * Math.sin(a1);
				// xy, xz, yz: the two axes of the plane take cos and sin
				out[o] = ring === 2 ? cx : cx + c0;
				out[o + 1] = ring === 0 ? cy + s0 : ring === 1 ? cy : cy + c0;
				out[o + 2] = ring === 0 ? cz : cz + s0;
				out[o + 3] = ring === 2 ? cx : cx + c1;
				out[o + 4] = ring === 0 ? cy + s1 : ring === 1 ? cy : cy + c1;
				out[o + 5] = ring === 0 ? cz : cz + s1;
				o += 6;
			}
		}
		this.paint(at, at + 2 * (last - first) * SEGMENTS, color);
		this.commit();
	}

	// Reserves room for `segments`: their first vertex, or −1 when they don't
	// fit
	private room(segments: number): number {
		const at = this.used;
		if (at + 2 * segments > 2 * this.capacity) return -1;
		this.used = at + 2 * segments;
		return at;
	}

	// An arrowhead on the shaft from vertex `tail` to vertex `tip`, as two
	// crossed V shapes, seen from any angle: four segments from vertex `at`
	private head(tail: number, tip: number, at: number): void {
		const out = this.vertices;
		const tx = out[tip * 3] as number;
		const ty = out[tip * 3 + 1] as number;
		const tz = out[tip * 3 + 2] as number;
		let ux = tx - (out[tail * 3] as number);
		let uy = ty - (out[tail * 3 + 1] as number);
		let uz = tz - (out[tail * 3 + 2] as number);
		// Float32 coordinates can round a short shaft away: the head then
		// shrinks to the tip
		const l = norm(ux, uy, uz);
		const k = 1 / Math.max(l, 1e-30);
		ux *= k;
		uy *= k;
		uz *= k;
		// The whole arrow here, not the last dash. Math.min, not a ternary:
		// V8 boxed the number a ternary picked between a field and l / 2
		const h = Math.min(this.headLength, l / 2);
		const w = h * SPREAD;

		// Two directions across the shaft: u × (+y), or u × (+x) when the
		// shaft is near y, then u × that one
		const ry = uy < 0.9 && uy > -0.9 ? 1 : 0;
		const rx = 1 - ry;
		let ax = -uz * ry;
		let ay = uz * rx;
		let az = ux * ry - uy * rx;
		const ak = 1 / Math.max(norm(ax, ay, az), 1e-30);
		ax *= ak;
		ay *= ak;
		az *= ak;
		const bx = uy * az - uz * ay;
		const by = uz * ax - ux * az;
		const bz = ux * ay - uy * ax;

		const baseX = tx - ux * h;
		const baseY = ty - uy * h;
		const baseZ = tz - uz * h;
		let o = at * 3;
		for (let i = 0; i < 4; i++) {
			// ±a, then ±b
			const sign = i & 1 ? -w : w;
			const ex = i < 2 ? ax : bx;
			const ey = i < 2 ? ay : by;
			const ez = i < 2 ? az : bz;
			out[o] = tx;
			out[o + 1] = ty;
			out[o + 2] = tz;
			out[o + 3] = baseX + ex * sign;
			out[o + 4] = baseY + ey * sign;
			out[o + 5] = baseZ + ez * sign;
			o += 6;
		}
	}

	// Colors vertices from to to − 1
	private paint(from: number, to: number, color: Color): void {
		const out = this.tints;
		const { r, g, b } = color;
		for (let i = from * 3; i < to * 3; i += 3) {
			out[i] = r;
			out[i + 1] = g;
			out[i + 2] = b;
		}
	}

	private commit(): void {
		this.geometry.setDrawRange(0, this.used);
		// The whole buffer: an update range would allocate a range per frame
		this.positionAttribute.needsUpdate = true;
		this.colorAttribute.needsUpdate = true;
	}
}
