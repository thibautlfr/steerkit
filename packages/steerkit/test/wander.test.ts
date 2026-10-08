import { describe, expect, it } from "vitest";
import {
	type Agent,
	createWanderState,
	type Plane,
	step,
	type WanderOptions,
	wander,
} from "../src/index.ts";
import { agent, seeded, vec } from "./helpers.ts";

const options: WanderOptions = { radius: 1, distance: 2, jitter: 3 };

// Positions of an agent wandering for `seconds`, `fps` steps per second
const walk = (
	seconds: number,
	fps: number,
	seed: number,
	plane?: Plane,
): { agent: Agent; path: { x: number; y: number; z: number }[] } => {
	const a = agent({ maxSpeed: 2, maxForce: 4 });
	const state = createWanderState(seeded(seed));
	const force = vec();
	const path = [];
	const opts = plane ? { ...options, plane } : options;
	for (let i = 0; i < seconds * fps; i++) {
		step(a, wander(a, state, opts, 1 / fps, force), 1 / fps);
		path.push({ ...a.position });
	}
	return { agent: a, path };
};

const span = (values: number[]): number =>
	Math.max(...values) - Math.min(...values);

describe("wander", () => {
	it("is reproducible with a seeded random", () => {
		expect(walk(5, 60, 1).path).toEqual(walk(5, 60, 1).path);
		expect(walk(5, 60, 1).path).not.toEqual(walk(5, 60, 2).path);
	});

	it("gets going from a stop", () => {
		const { agent: a } = walk(1, 60, 3);
		expect(
			Math.hypot(a.velocity.x, a.velocity.y, a.velocity.z),
		).toBeGreaterThan(1);
	});

	it("roams in all three axes without a plane", () => {
		const { path } = walk(30, 60, 4);
		expect(span(path.map((p) => p.x))).toBeGreaterThan(2);
		expect(span(path.map((p) => p.y))).toBeGreaterThan(2);
		expect(span(path.map((p) => p.z))).toBeGreaterThan(2);
	});

	it.each([
		["xy", "z"],
		["xz", "y"],
		["yz", "x"],
	] as const)("stays in the %s plane", (plane, axis) => {
		const { path } = walk(30, 60, 5, plane);
		expect(path.every((p) => p[axis] === 0)).toBe(true);
	});

	it("keeps turning toward a point kept on its side", () => {
		// No jitter: a point on the left stays on the left, so the agent
		// circles. A point fixed in space would turn it by atan(1 / 2) ≈ 0.46
		// rad at most, before lining up with it
		const a = agent({ velocity: vec(1, 0, 0), maxForce: 4 });
		const state = createWanderState();
		state.offset = vec(0, 1, 0);
		state.heading = vec(1, 0, 0);
		const opts: WanderOptions = { ...options, jitter: 0, plane: "xy" };
		const force = vec();
		let turned = 0;
		let heading = Math.atan2(a.velocity.y, a.velocity.x);
		for (let i = 0; i < 600; i++) {
			step(a, wander(a, state, opts, 1 / 60, force), 1 / 60);
			const next = Math.atan2(a.velocity.y, a.velocity.x);
			let delta = next - heading;
			if (delta > Math.PI) delta -= 2 * Math.PI;
			if (delta < -Math.PI) delta += 2 * Math.PI;
			turned += delta;
			heading = next;
		}
		expect(turned).toBeGreaterThan(Math.PI);
	});

	it("turns about as much at any framerate", () => {
		// Mean turn rate over many seeds, in radians per second
		const turnRate = (fps: number): number => {
			let total = 0;
			for (let seed = 0; seed < 40; seed++) {
				const { path } = walk(10, fps, seed, "xy");
				for (let i = 2; i < path.length; i++) {
					const [a, b, c] = [path[i - 2], path[i - 1], path[i]] as const;
					if (!a || !b || !c) continue;
					const h1 = Math.atan2(b.y - a.y, b.x - a.x);
					const h2 = Math.atan2(c.y - b.y, c.x - b.x);
					let d = Math.abs(h2 - h1);
					if (d > Math.PI) d = 2 * Math.PI - d;
					total += d;
				}
			}
			return total / (40 * 10);
		};
		const slow = turnRate(30);
		const fast = turnRate(144);
		expect(fast / slow).toBeGreaterThan(0.8);
		expect(fast / slow).toBeLessThan(1.25);
	});
});
