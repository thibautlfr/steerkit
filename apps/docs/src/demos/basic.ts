import {
	type Agent,
	arrive,
	blend,
	flee,
	keepAway,
	seek,
	step,
	type Vec3,
} from "steerkit";
import { agentCode, agentParams, type Demo, n, vec, wrap } from "../demo.ts";
import { Trail } from "../draw.ts";

const makeAgent = (x: number, y: number): Agent => ({
	position: vec(x, y),
	velocity: vec(),
	maxSpeed: 3,
	maxForce: 4,
});

export const seekDemo: Demo = {
	id: "seek",
	title: "Seek",
	summary:
		"Full speed toward a target. The steering force (orange) is the velocity the agent wants (green: straight at the target, at maxSpeed) minus the velocity it has (blue): Reynolds' whole model in one subtraction. With nothing to slow it down, seek overshoots and circles back; that's what arrive is for.",
	hint: "Move the pointer to set the target",
	params: agentParams(),
	code: (v) =>
		`${agentCode(v)}\n\n// Every frame\nseek(agent, target, force);\nstep(agent, force, dt);`,
	create: (world) => {
		const agent = makeAgent(1, world.height / 2);
		const force = vec();
		const trail = new Trail();
		return {
			update(dt, v, w) {
				agent.maxSpeed = v.maxSpeed ?? 3;
				agent.maxForce = v.maxForce ?? 4;
				seek(agent, w.pointer, force);
				step(agent, force, dt);
				trail.push(agent.position, dt);
			},
			draw(d, _, w) {
				d.trail(trail.points);
				d.target(w.pointer);
				d.agent(agent);
				d.vectors(agent, force);
			},
		};
	},
};

export const fleeDemo: Demo = {
	id: "flee",
	title: "Flee",
	summary:
		"Seek's opposite: full speed away from a point, however far it is. Here the agent wraps around the edges, or it would run away for good; keepAway is the version that only cares within a radius.",
	hint: "Chase the agent with the pointer",
	params: agentParams(),
	code: (v) =>
		`${agentCode(v)}\n\n// Every frame\nflee(agent, threat, force);\nstep(agent, force, dt);`,
	create: (world) => {
		const agent = makeAgent(world.width / 2, world.height / 2);
		const force = vec();
		const trail = new Trail();
		return {
			update(dt, v, w) {
				agent.maxSpeed = v.maxSpeed ?? 3;
				agent.maxForce = v.maxForce ?? 4;
				flee(agent, w.pointer, force);
				step(agent, force, dt);
				wrap(agent.position, w);
				trail.push(agent.position, dt);
			},
			draw(d, _, w) {
				d.trail(trail.points);
				d.target(w.pointer);
				d.agent(agent);
				d.vectors(agent, force);
			},
		};
	},
};

export const arriveDemo: Demo = {
	id: "arrive",
	title: "Arrive",
	summary:
		"Seek that slows down: within slowingDistance of the target (the dashed circle), the desired speed drops in proportion to the distance left, down to a stop on the target itself. Set slowingDistance to 0 and it seeks again, overshoot included.",
	hint: "Move the pointer to set the target",
	params: [
		...agentParams(),
		{
			key: "slowingDistance",
			label: "slowingDistance",
			value: 2.5,
			min: 0,
			max: 6,
			step: 0.1,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n\n// Every frame\narrive(agent, target, { slowingDistance: ${n(v.slowingDistance ?? 0)} }, force);\nstep(agent, force, dt);`,
	create: (world) => {
		const agent = makeAgent(1, world.height / 2);
		const force = vec();
		const trail = new Trail();
		const options = { slowingDistance: 2.5 };
		return {
			update(dt, v, w) {
				agent.maxSpeed = v.maxSpeed ?? 3;
				agent.maxForce = v.maxForce ?? 4;
				options.slowingDistance = v.slowingDistance ?? 0;
				arrive(agent, w.pointer, options, force);
				step(agent, force, dt);
				trail.push(agent.position, dt);
			},
			draw(d, v, w) {
				d.trail(trail.points);
				d.circle(
					w.pointer,
					v.slowingDistance ?? 0,
					d.colors.muted,
					undefined,
					[4, 4],
				);
				d.target(w.pointer);
				d.agent(agent);
				d.vectors(agent, force);
			},
		};
	},
};

export const keepAwayDemo: Demo = {
	id: "keep-away",
	title: "Keep away",
	summary:
		"Flee, but only within a radius, and harder the closer the threat gets: the force fades to nothing at the edge, so entering the zone doesn't jolt. A personal space around a point. Each agent here blends it with arrive, back to its own spot.",
	hint: "Move the pointer through the crowd",
	params: [
		...agentParams(3, 6),
		{ key: "radius", label: "radius", value: 2, min: 0.2, max: 5, step: 0.1 },
		{
			key: "weight",
			label: "keepAway weight",
			value: 3,
			min: 0,
			max: 8,
			step: 0.1,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n\n// Every frame\nblend(force,\n\t[arrive(agent, home, { slowingDistance: 1 }, goal), 1],\n\t[keepAway(agent, pointer, { radius: ${n(v.radius ?? 0)} }, away), ${n(v.weight ?? 0)}],\n);\nstep(agent, force, dt);`,
	create: (world) => {
		const crowd: { agent: Agent; home: Vec3; force: Vec3 }[] = [];
		for (let x = 1; x < world.width; x += 1.4) {
			for (let y = 1; y < world.height; y += 1.4) {
				crowd.push({ agent: makeAgent(x, y), home: vec(x, y), force: vec() });
			}
		}
		const goal = vec();
		const away = vec();
		const slowing = { slowingDistance: 1 };
		const around = { radius: 2 };
		return {
			update(dt, v, w) {
				around.radius = v.radius ?? 2;
				for (const { agent, home, force } of crowd) {
					agent.maxSpeed = v.maxSpeed ?? 3;
					agent.maxForce = v.maxForce ?? 6;
					blend(
						force,
						[arrive(agent, home, slowing, goal), 1],
						[keepAway(agent, w.pointer, around, away), v.weight ?? 3],
					);
					step(agent, force, dt);
				}
			},
			draw(d, v, w) {
				d.circle(w.pointer, v.radius ?? 2, d.colors.target, d.colors.zone);
				d.target(w.pointer);
				for (const { agent, home, force } of crowd) {
					d.dot(home, d.colors.trail, 3);
					d.agent(agent, undefined, 8);
					d.vectors(agent, force);
				}
			},
		};
	},
};
