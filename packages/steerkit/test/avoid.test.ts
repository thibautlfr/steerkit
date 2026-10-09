import { describe, expect, it } from "vitest";
import {
	avoidCollisions,
	avoidObstacles,
	type Mover,
	type Vec3,
} from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

const expectClose = (actual: Vec3, expected: Vec3) => {
	expect(actual.x).toBeCloseTo(expected.x, 9);
	expect(actual.y).toBeCloseTo(expected.y, 9);
	expect(actual.z).toBeCloseTo(expected.z, 9);
};

const ahead = { radius: 0.5, lookAhead: 5 };
const flat = { ...ahead, plane: "xy" as const };

// The force that turns an agent at speed `speed`, heading +x, toward the
// direction at `angle` (radians) from +x in the xy plane
const turn = (speed: number, angle: number): Vec3 =>
	vec(speed * Math.cos(angle) - speed, speed * Math.sin(angle), 0);

describe("avoidObstacles", () => {
	it("turns right of an obstacle dead ahead, along the tangent that clears it", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const rock = { position: vec(3, 0, 0), radius: 0.5 };
		// Reach 1 at distance 3: the tangent is asin(1/3) off the heading,
		// to the right of +x with +y up: +z
		const far = avoidObstacles(a, [rock], ahead, vec());
		const sin = 1 / 3;
		expectClose(far, vec(Math.sqrt(1 - sin * sin) - 1, 0, sin));
		// Nearer, a wider turn
		rock.position.x = 1.5;
		const near = avoidObstacles(a, [rock], ahead, vec());
		expect(near.z).toBeGreaterThan(far.z);
		expect(near.z).toBeCloseTo(2 / 3, 9);
	});

	it("takes up from the plane's normal", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const rock = { position: vec(3, 0, 0), radius: 0.5 };
		// forward × +z: −y
		expectClose(
			avoidObstacles(a, [rock], flat, vec()),
			turn(1, -Math.asin(1 / 3)),
		);
	});

	it("turns away from the side the obstacle is on, keeping its speed", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const rock = { position: vec(3, 0.3, 0), radius: 0.5 };
		// The tangent below the rock: its bearing minus the half-angle it spans
		const angle = Math.atan2(0.3, 3) - Math.asin(1 / Math.hypot(3, 0.3));
		expectClose(avoidObstacles(a, [rock], flat, vec()), turn(1, angle));
		rock.position.y = -0.3;
		expectClose(avoidObstacles(a, [rock], flat, vec()), turn(1, -angle));
	});

	it("ignores what is behind, aside, or beyond lookAhead", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const rocks = [
			{ position: vec(-2, 0, 0), radius: 0.5 },
			{ position: vec(3, 1.1, 0), radius: 0.5 },
			{ position: vec(6, 0, 0), radius: 0.5 },
		];
		expect(avoidObstacles(a, rocks, ahead, vec())).toEqual(vec());
	});

	it("avoids the nearest of the obstacles in the way", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const rocks = [
			{ position: vec(4, -0.3, 0), radius: 0.5 },
			{ position: vec(2, 0.3, 0), radius: 0.5 },
		];
		const angle = Math.atan2(0.3, 2) - Math.asin(1 / Math.hypot(2, 0.3));
		expectClose(avoidObstacles(a, rocks, flat, vec()), turn(1, angle));
	});

	it("steers straight out of an obstacle at full speed", () => {
		const a = agent({ position: vec(0.2, 0, 0), velocity: vec(0, 1, 0) });
		const rock = { position: vec(), radius: 0.5 };
		expectClose(avoidObstacles(a, [rock], ahead, vec()), vec(2, -1, 0));
	});

	it("sees nothing ahead when lookAhead is not positive", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const rock = { position: vec(3, 0, 0), radius: 0.5 };
		for (const lookAhead of [0, -1, Number.NaN]) {
			expect(
				avoidObstacles(a, [rock], { radius: 0.5, lookAhead }, vec()),
			).toEqual(vec());
		}
	});

	it("may write into any of its inputs", () => {
		const make = () => ({
			a: agent({ position: vec(), velocity: vec(1, 0, 0) }),
			rock: { position: vec(3, 0.3, 0), radius: 0.5 },
		});
		const { a, rock } = make();
		const expected = avoidObstacles(a, [rock], flat, vec());
		for (const pick of [
			(s: ReturnType<typeof make>) => s.a.position,
			(s: ReturnType<typeof make>) => s.a.velocity,
			(s: ReturnType<typeof make>) => s.rock.position,
		]) {
			const s = make();
			expectClose(avoidObstacles(s.a, [s.rock], flat, pick(s)), expected);
		}
	});
});

describe("avoidCollisions", () => {
	const mover = (position: Vec3, velocity: Vec3): Mover => ({
		position,
		velocity,
	});

	it("makes two agents head-on turn right, and pass", () => {
		const a = agent({ position: vec(0, 0, 0), velocity: vec(1, 0, 0) });
		const b = agent({ position: vec(4, 0, 0), velocity: vec(-1, 0, 0) });
		const crowd = [a, b];
		// They'd meet in 2 s of 5: urgency 0.6 of maxSpeed (2)
		expectClose(avoidCollisions(a, crowd, flat, vec()), vec(0, -1.2, 0));
		expectClose(avoidCollisions(b, crowd, flat, vec()), vec(0, 1.2, 0));
	});

	it("ignores movers that keep their distance", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		const others = [
			mover(vec(0, 1.5, 0), vec(1, 0, 0)), // alongside, same velocity
			mover(vec(-3, 0, 0), vec(-1, 0, 0)), // moving away
			mover(vec(4, 3, 0), vec(-1, 0, 0)), // passing far aside
		];
		expect(avoidCollisions(a, others, flat, vec())).toEqual(vec());
	});

	it("dodges a mover crossing its way", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		// Coming up from below, it would pass just ahead of the agent in 2.1 s
		const crossing = mover(vec(2.2, -2, 0), vec(0, 1, 0));
		const force = avoidCollisions(a, [crossing], flat, vec());
		// Away from where it'll be: the agent slows down and slips behind it
		expect(force.x).toBeLessThan(0);
		expect(force.y).toBeLessThan(0);
	});

	it("dodges sideways when still", () => {
		const a = agent();
		const b = mover(vec(3, 0, 0), vec(-1, 0, 0));
		const force = avoidCollisions(a, [b], flat, vec());
		expect(force.x).toBeCloseTo(0, 9);
		expect(Math.abs(force.y)).toBeGreaterThan(0);
	});

	it("pushes apart agents already within reach", () => {
		const a = agent({ position: vec(0, 0, 0) });
		const b = mover(vec(0.5, 0, 0), vec());
		expectClose(avoidCollisions(a, [b], flat, vec()), vec(-2, 0, 0));
	});

	it("ignores the agent itself in the crowd", () => {
		const a = agent({ velocity: vec(1, 0, 0) });
		expect(avoidCollisions(a, [a], flat, vec())).toEqual(vec());
	});
});
