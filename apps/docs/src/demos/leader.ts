import {
	type Agent,
	arrive,
	blend,
	type FollowOptions,
	follow,
	type OffsetPursuitOptions,
	offsetPursuit,
	separation,
	step,
	type Vec3,
} from "steerkit";
import { agentCode, agentParams, type Demo, n, vec } from "../demo.ts";
import { type Draw, Trail } from "../draw.ts";
import { page } from "../pages.ts";

// A leader that arrives at the pointer
const createLeader = (world: { width: number; height: number }): Agent => ({
	position: vec(world.width / 2, world.height / 2),
	velocity: vec(),
	maxSpeed: 2.4,
	maxForce: 5,
});

// The leader's heading and right side in the xy plane, as steerkit derives
// them (forward × +z), for drawing
const frame = (leader: Agent): { forward: Vec3; side: Vec3 } | undefined => {
	const { x, y } = leader.velocity;
	const speed = Math.hypot(x, y);
	if (speed < 1e-9) return undefined;
	const forward = vec(x / speed, y / speed);
	return { forward, side: vec(forward.y, -forward.x) };
};

const drawLeader = (d: Draw, leader: Agent, trail: Trail) => {
	d.trail(trail.points);
	d.agent(leader, d.colors.target, 13);
};

export const leaderFollowingDemo: Demo = {
	...page("leader-following"),
	hint: "The leader goes to the pointer",
	params: [
		...agentParams(3, 6),
		{
			key: "distance",
			label: "distance",
			value: 1.5,
			min: 0.5,
			max: 3,
			step: 0.1,
		},
		{
			key: "separation",
			label: "separation weight",
			value: 1.5,
			min: 0,
			max: 4,
			step: 0.05,
		},
	],
	code: (v) =>
		`${agentCode(v).replace("agent", "follower")}\n\n// Every frame, for each follower. followers is the list of them\nblend(force,\n\t[follow(follower, leader, { distance: ${n(v.distance ?? 0)}, slowingDistance: 1.5, plane: "xy" }, behind), 1],\n\t[separation(follower, followers, { radius: 0.8 }, apart), ${n(v.separation ?? 0)}],\n);\nstep(follower, force, dt);`,
	create: (world) => {
		const leader = createLeader(world);
		const leaderForce = vec();
		const slowing = { slowingDistance: 1.5 };
		const followers: Agent[] = [];
		const forces: Vec3[] = [];
		for (let i = 0; i < 7; i++) {
			followers.push({
				position: vec(
					Math.random() * world.width,
					Math.random() * world.height,
				),
				velocity: vec(),
				maxSpeed: 3,
				maxForce: 6,
			});
			forces.push(vec());
		}
		const options: FollowOptions = {
			distance: 1.5,
			slowingDistance: 1.5,
			plane: "xy",
		};
		const apart = { radius: 0.8 };
		const behind = vec();
		const away = vec();
		const trail = new Trail(60);
		return {
			update(dt, v, w) {
				arrive(leader, w.pointer, slowing, leaderForce);
				step(leader, leaderForce, dt);
				trail.push(leader.position, dt);
				options.distance = v.distance ?? 1.5;
				followers.forEach((follower, i) => {
					const force = forces[i] as Vec3;
					follower.maxSpeed = v.maxSpeed ?? 3;
					follower.maxForce = v.maxForce ?? 6;
					blend(
						force,
						[follow(follower, leader, options, behind), 1],
						[separation(follower, followers, apart, away), v.separation ?? 1.5],
					);
					step(follower, force, dt);
				});
			},
			draw(d, v) {
				const distance = v.distance ?? 1.5;
				const f = frame(leader);
				if (f) {
					// The leader's way, where followers step aside: `distance`
					// ahead of it, `distance` to each side of its path
					const { forward: h, side: s } = f;
					const p = leader.position;
					const corner = (a: number, b: number) =>
						vec(
							p.x + h.x * a * distance + s.x * b * distance,
							p.y + h.y * a * distance + s.y * b * distance,
						);
					d.polygon(
						[corner(0, -1), corner(1, -1), corner(1, 1), corner(0, 1)],
						d.colors.zone,
					);
					d.dot(
						vec(p.x - h.x * distance, p.y - h.y * distance),
						d.colors.muted,
						4,
					);
				}
				drawLeader(d, leader, trail);
				followers.forEach((follower, i) => {
					d.agent(follower);
					if (i === 0) d.vectors(follower, forces[0] as Vec3);
				});
			},
		};
	},
};

export const offsetPursuitDemo: Demo = {
	...page("offset-pursuit"),
	hint: "The leader goes to the pointer",
	params: [
		...agentParams(3.5, 8),
		{
			key: "spacing",
			label: "spacing",
			value: 0.8,
			min: 0.3,
			max: 2,
			step: 0.05,
		},
		{
			key: "slowingDistance",
			label: "slowingDistance",
			value: 1,
			min: 0,
			max: 4,
			step: 0.1,
		},
	],
	code: (v) =>
		`${agentCode(v).replace("agent", "wingman")}\n\n// One slot per wingman, in the leader's frame: a V behind it\nconst slots = [1, 2, 3].flatMap((k) => [-1, 1].map((s) => ({\n\tahead: -k * ${n(v.spacing ?? 0)},\n\tside: s * k * ${n(v.spacing ?? 0)},\n\tslowingDistance: ${n(v.slowingDistance ?? 0)},\n\tplane: "xy",\n})));\n\n// Every frame, wingman i keeps slots[i]\noffsetPursuit(wingman, leader, slots[i], force);\nstep(wingman, force, dt);`,
	create: (world) => {
		const leader = createLeader(world);
		const leaderForce = vec();
		const slowing = { slowingDistance: 1.5 };
		const slots: OffsetPursuitOptions[] = [1, 2, 3].flatMap((k) =>
			[-1, 1].map((s) => ({
				ahead: -k,
				side: s * k,
				slowingDistance: 1,
				plane: "xy" as const,
			})),
		);
		const wingmen = slots.map(() => ({
			agent: {
				position: vec(
					Math.random() * world.width,
					Math.random() * world.height,
				),
				velocity: vec(),
				maxSpeed: 3.5,
				maxForce: 8,
			} as Agent,
			force: vec(),
		}));
		const trail = new Trail(60);
		return {
			update(dt, v, w) {
				arrive(leader, w.pointer, slowing, leaderForce);
				step(leader, leaderForce, dt);
				trail.push(leader.position, dt);
				const spacing = v.spacing ?? 0.8;
				slots.forEach((slot, i) => {
					const k = Math.floor(i / 2) + 1;
					slot.ahead = -k * spacing;
					slot.side = (i % 2 === 0 ? -1 : 1) * k * spacing;
					slot.slowingDistance = v.slowingDistance ?? 1;
					const wingman = wingmen[i];
					if (!wingman) return;
					wingman.agent.maxSpeed = v.maxSpeed ?? 3.5;
					wingman.agent.maxForce = v.maxForce ?? 8;
					offsetPursuit(wingman.agent, leader, slot, wingman.force);
					step(wingman.agent, wingman.force, dt);
				});
			},
			draw(d) {
				const f = frame(leader);
				if (f) {
					const { forward: h, side: s } = f;
					const p = leader.position;
					for (const slot of slots) {
						d.circle(
							vec(
								p.x + h.x * slot.ahead + s.x * slot.side,
								p.y + h.y * slot.ahead + s.y * slot.side,
							),
							d.px(7),
							d.colors.muted,
							undefined,
							[2, 2],
						);
					}
				}
				drawLeader(d, leader, trail);
				wingmen.forEach(({ agent, force }, i) => {
					d.agent(agent);
					if (i === 0) d.vectors(agent, force);
				});
			},
		};
	},
};
