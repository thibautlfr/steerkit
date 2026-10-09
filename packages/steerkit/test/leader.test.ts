import { describe, expect, it } from "vitest";
import { follow, type Mover, offsetPursuit, type Vec3 } from "../src/index.ts";
import { agent, vec } from "./helpers.ts";

const leader = (position: Vec3, velocity: Vec3): Mover => ({
	position,
	velocity,
});

const expectClose = (actual: Vec3, expected: Vec3) => {
	expect(actual.x).toBeCloseTo(expected.x, 9);
	expect(actual.y).toBeCloseTo(expected.y, 9);
	expect(actual.z).toBeCloseTo(expected.z, 9);
};

describe("offsetPursuit", () => {
	it("matches the leader's velocity once in its slot", () => {
		// Leader heading +x on the ground: its right is +z (forward × up)
		const l = leader(vec(0, 0, 0), vec(1, 0, 0));
		const a = agent({ position: vec(-1, 0, 2), velocity: vec(0.5, 0, 0) });
		const force = offsetPursuit(
			a,
			l,
			{ ahead: -1, side: 2, slowingDistance: 1 },
			vec(),
		);
		expectClose(force, vec(0.5, 0, 0));
	});

	it("heads for its slot, at full speed from afar", () => {
		const l = leader(vec(0, 0, 0), vec(1, 0, 0));
		// The slot is (0, 0, 2); the agent 4 below it: pull of maxSpeed (2)
		// toward +z, plus the leader's velocity, bounded by maxSpeed
		const a = agent({ position: vec(0, 0, -2) });
		const force = offsetPursuit(
			a,
			l,
			{ ahead: 0, side: 2, slowingDistance: 1 },
			vec(),
		);
		const k = 2 / Math.hypot(1, 2);
		expectClose(force, vec(1 * k, 0, 2 * k));
	});

	it("eases into its slot within the slowing distance", () => {
		const l = leader(vec(), vec());
		// Still leader: the slot is 1 along x. Half the slowing distance away,
		// half the speed
		const a = agent({ position: vec(0, 0, 0) });
		const force = offsetPursuit(
			a,
			l,
			{ ahead: 1, side: 0, slowingDistance: 2 },
			vec(),
		);
		expectClose(force, vec(1, 0, 0));
	});

	it("takes the side from the plane's normal", () => {
		const l = leader(vec(), vec(1, 0, 0));
		const options = { ahead: 0, side: 1, slowingDistance: 0 };
		// In xy, up is +z: the right of +x is −y. Pace (1, 0) plus a full
		// pull toward the slot, bounded by maxSpeed
		const xy = offsetPursuit(agent(), l, { ...options, plane: "xy" }, vec());
		expectClose(xy, norm2(vec(1, -2, 0)));
		// On the ground (xz, or no plane), up is +y: the right of +x is +z
		const xz = offsetPursuit(agent(), l, { ...options, plane: "xz" }, vec());
		expectClose(xz, norm2(vec(1, 0, 2)));
		expectClose(offsetPursuit(agent(), l, options, vec()), xz);
	});

	it("ignores the side when the leader heads straight up", () => {
		const l = leader(vec(), vec(0, 3, 0));
		const force = offsetPursuit(
			agent({ position: vec(0, 1, 0) }),
			l,
			{ ahead: 1, side: 5, slowingDistance: 1 },
			vec(),
		);
		expectClose(force, norm2(vec(0, 3, 0)));
	});
});

describe("follow", () => {
	it("matches the leader's velocity once behind it", () => {
		const l = leader(vec(3, 0, 0), vec(1, 0, 0));
		const a = agent({ position: vec(1, 0, 0) });
		const force = follow(a, l, { distance: 2, slowingDistance: 1 }, vec());
		expectClose(force, vec(1, 0, 0));
	});

	it("steps aside when in the leader's way", () => {
		const l = leader(vec(0, 0, 0), vec(1, 0, 0));
		// Just ahead of the leader, a little to its left (−z on the ground)
		const a = agent({ position: vec(0.5, 0, -0.2) });
		const force = follow(a, l, { distance: 2, slowingDistance: 1 }, vec());
		// The leader's pace plus a full pull to −z, bounded by maxSpeed
		expectClose(force, norm2(vec(1, 0, -2)));
	});

	it("steps aside to the leader's right when dead on its path", () => {
		const l = leader(vec(0, 0, 0), vec(1, 0, 0));
		const force = follow(
			agent({ position: vec(1, 0, 0) }),
			l,
			{ distance: 2, slowingDistance: 1 },
			vec(),
		);
		expectClose(force, norm2(vec(1, 0, 2)));
	});

	it("keeps a still leader at distance, on its own side", () => {
		const l = leader(vec(0, 0, 0), vec());
		const a = agent({ position: vec(0, 5, 0) });
		const force = follow(a, l, { distance: 2, slowingDistance: 1 }, vec());
		expectClose(force, vec(0, -2, 0));
		expect(
			follow(agent(), l, { distance: 2, slowingDistance: 1 }, vec()),
		).toEqual(vec());
	});
});

describe("out", () => {
	it.each([
		[
			"offsetPursuit",
			(a: ReturnType<typeof agent>, l: Mover, out: Vec3) =>
				offsetPursuit(a, l, { ahead: -1, side: 1, slowingDistance: 2 }, out),
		],
		[
			"follow",
			(a: ReturnType<typeof agent>, l: Mover, out: Vec3) =>
				follow(a, l, { distance: 1, slowingDistance: 2 }, out),
		],
	])("%s may alias any input", (_, behavior) => {
		const make = () => ({
			a: agent({ position: vec(0.5, 0.2, 0), velocity: vec(1, 0.5, 0) }),
			l: leader(vec(1, 1, 0.5), vec(0.3, 1, 0)),
		});
		const fresh = make();
		const expected = behavior(fresh.a, fresh.l, vec());
		for (const pick of [
			(s: ReturnType<typeof make>) => s.a.position,
			(s: ReturnType<typeof make>) => s.a.velocity,
			(s: ReturnType<typeof make>) => s.l.position,
			(s: ReturnType<typeof make>) => s.l.velocity,
		]) {
			const s = make();
			expectClose(behavior(s.a, s.l, pick(s)), expected);
		}
	});
});

// `v` scaled to the default agent's maxSpeed (2)
function norm2(v: Vec3): Vec3 {
	const l = Math.hypot(v.x, v.y, v.z);
	return vec((v.x / l) * 2, (v.y / l) * 2, (v.z / l) * 2);
}
