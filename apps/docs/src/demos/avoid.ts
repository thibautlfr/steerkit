import {
	type Agent,
	type AvoidanceOptions,
	addWithin,
	arrive,
	avoidCollisions,
	avoidObstacles,
	type Mover,
	type Obstacle,
	prioritize,
	seek,
	separation,
	step,
	type Vec3,
	zero,
} from "steerkit";
import { agentCode, agentParams, type Demo, n, vec, wrap } from "../demo.ts";
import type { Draw } from "../draw.ts";
import { page } from "../pages.ts";

// A seeded generator, so the rocks are laid out the same on every visit
const seeded = (seed: number) => () => {
	seed = (seed * 1664525 + 1013904223) >>> 0;
	return seed / 4294967296;
};

// Rocks scattered over the world, on a jittered grid so none overlap
const scatter = (world: { width: number; height: number }): Obstacle[] => {
	const random = seeded(7);
	const rocks: Obstacle[] = [];
	const cols = Math.max(2, Math.round(world.width / 2.6));
	const rows = Math.max(2, Math.round(world.height / 2.6));
	const w = world.width / cols;
	const h = world.height / rows;
	for (let i = 0; i < cols; i++) {
		for (let j = 0; j < rows; j++) {
			if (random() < 0.25) continue;
			const radius = 0.35 + random() * 0.45;
			rocks.push({
				position: vec(
					(i + 0.5) * w + (random() - 0.5) * (w - 2 * radius) * 0.6,
					(j + 0.5) * h + (random() - 0.5) * (h - 2 * radius) * 0.6,
				),
				radius,
			});
		}
	}
	return rocks;
};

// The corridor an agent watches: as wide as it, as long as it travels in
// `lookAhead` seconds
const drawCorridor = (
	d: Draw,
	agent: Agent,
	radius: number,
	lookAhead: number,
) => {
	const { position: p, velocity: v } = agent;
	const speed = Math.hypot(v.x, v.y);
	if (speed < 1e-6) return;
	const hx = v.x / speed;
	const hy = v.y / speed;
	const length = speed * lookAhead;
	const corner = (a: number, b: number) =>
		vec(p.x + hx * a - hy * b, p.y + hy * a + hx * b);
	d.polygon(
		[
			corner(0, -radius),
			corner(length, -radius),
			corner(length, radius),
			corner(0, radius),
		],
		d.colors.zone,
	);
};

export const obstacleAvoidanceDemo: Demo = {
	...page("obstacle-avoidance"),
	hint: "The agents go to the pointer",
	params: [
		...agentParams(3, 8),
		{
			key: "lookAhead",
			label: "lookAhead (s)",
			value: 0.8,
			min: 0,
			max: 2,
			step: 0.05,
		},
		{
			key: "radius",
			label: "radius",
			value: 0.25,
			min: 0.05,
			max: 0.8,
			step: 0.05,
		},
		{
			key: "weight",
			label: "avoidance weight",
			value: 3,
			min: 0,
			max: 5,
			step: 0.1,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n// Circles (spheres in 3D): any { position, radius }\nconst rocks = [{ position, radius: 0.6 }, …];\n\n// Every frame: avoidance first, and weighted, or the pull toward a\n// pointer behind a rock would cancel it\nzero(force);\naddWithin(force, agent.maxForce, avoidObstacles(agent, rocks, { radius: ${n(v.radius ?? 0)}, lookAhead: ${n(v.lookAhead ?? 0)}, plane: "xy" }, tmp), ${n(v.weight ?? 0)});\naddWithin(force, agent.maxForce, separation(agent, crowd, { radius: 0.5 }, tmp));\naddWithin(force, agent.maxForce, arrive(agent, pointer, { slowingDistance: 1.5 }, tmp));\nstep(agent, force, dt);`,
	create: (world) => {
		const rocks = scatter(world);
		const agents: Agent[] = [];
		const forces: Vec3[] = [];
		for (let i = 0; i < 6; i++) {
			agents.push({
				position: vec(0.3, world.height * ((i + 0.5) / 6)),
				velocity: vec(),
				maxSpeed: 3,
				maxForce: 8,
			});
			forces.push(vec());
		}
		const options: AvoidanceOptions = {
			radius: 0.25,
			lookAhead: 0.8,
			plane: "xy",
		};
		const close = { radius: 0.5 };
		const slowing = { slowingDistance: 1.5 };
		const tmp = vec();
		return {
			update(dt, v, w) {
				options.radius = v.radius ?? 0.25;
				options.lookAhead = v.lookAhead ?? 0.8;
				agents.forEach((agent, i) => {
					agent.maxSpeed = v.maxSpeed ?? 3;
					agent.maxForce = v.maxForce ?? 8;
					const force = forces[i] as Vec3;
					const budget = agent.maxForce;
					zero(force);
					addWithin(
						force,
						budget,
						avoidObstacles(agent, rocks, options, tmp),
						v.weight ?? 3,
					);
					addWithin(force, budget, separation(agent, agents, close, tmp));
					addWithin(force, budget, arrive(agent, w.pointer, slowing, tmp));
					step(agent, force, dt);
				});
			},
			draw(d, _, w) {
				const [lead] = agents;
				if (lead) drawCorridor(d, lead, options.radius, options.lookAhead);
				for (const rock of rocks) {
					// The rocks the highlighted agent is avoiding: those that alone
					// would push it
					const push = lead && avoidObstacles(lead, [rock], options, tmp);
					const near = push && Math.hypot(push.x, push.y) > 0;
					d.circle(
						rock.position,
						rock.radius,
						near ? d.colors.steering : d.colors.muted,
						d.colors.zone,
					);
				}
				d.target(w.pointer);
				agents.forEach((agent, i) => {
					d.circle(
						agent.position,
						options.radius,
						d.colors.muted,
						undefined,
						[2, 2],
					);
					d.agent(agent, i === 0 ? d.colors.agent : d.colors.muted, 9);
				});
				if (lead) d.vectors(lead, forces[0] as Vec3);
			},
		};
	},
};

// How many agents per stream, and how far apart they start
const STREAM = 14;

export const collisionAvoidanceDemo: Demo = {
	...page("collision-avoidance"),
	hint: "Walk the pointer through the crowd",
	params: [
		...agentParams(2, 6),
		{
			key: "mode",
			label: "avoidance",
			value: 0,
			options: ["on", "off"],
		},
		{
			key: "lookAhead",
			label: "lookAhead (s)",
			value: 1.5,
			min: 0.1,
			max: 4,
			step: 0.05,
		},
		{
			key: "radius",
			label: "radius",
			value: 0.25,
			min: 0.1,
			max: 0.6,
			step: 0.05,
		},
	],
	code: (v) =>
		v.mode === 1
			? `${agentCode(v)}\n\n// Every frame: straight on, blind to the others\nseek(agent, aheadInLane, force);\nstep(agent, force, dt);`
			: `${agentCode(v)}\n\n// Every frame, for each agent. crowd is the list of all movers,\n// the agent itself included: avoidCollisions ignores it\nprioritize(force, agent.maxForce,\n\tavoidCollisions(agent, crowd, { radius: ${n(v.radius ?? 0)}, lookAhead: ${n(v.lookAhead ?? 0)}, plane: "xy" }, dodge),\n\tseek(agent, aheadInLane, cruise),\n);\nstep(agent, force, dt);`,
	create: (world) => {
		// Agents heading right, and agents heading down, crossing in the middle
		type Walker = { agent: Agent; force: Vec3; dx: number; dy: number };
		const walkers: Walker[] = [];
		for (let i = 0; i < STREAM * 2; i++) {
			const across = i < STREAM;
			const k = (i % STREAM) / STREAM;
			walkers.push({
				agent: {
					position: across
						? vec(k * world.width, world.height * (0.35 + Math.random() * 0.3))
						: vec(world.width * (0.35 + Math.random() * 0.3), k * world.height),
					velocity: vec(),
					maxSpeed: 2,
					maxForce: 6,
				},
				force: vec(),
				dx: across ? 1 : 0,
				dy: across ? 0 : 1,
			});
		}
		// The pointer, a mover like the others
		const walker: Mover = { position: vec(), velocity: vec() };
		const crowd: Mover[] = [...walkers.map((w) => w.agent), walker];
		const options: AvoidanceOptions = {
			radius: 0.25,
			lookAhead: 1.5,
			plane: "xy",
		};
		const dodge = vec();
		const cruise = vec();
		const ahead = vec();
		// The pairs within reach of each other, and how many times a pair
		// came within reach since the mode last changed
		let touching = new Set<number>();
		let next = new Set<number>();
		let bumps = 0;
		let mode = 0;
		return {
			update(dt, v, w) {
				Object.assign(walker.position, w.pointer);
				Object.assign(walker.velocity, w.pointerVelocity);
				options.radius = v.radius ?? 0.25;
				options.lookAhead = v.lookAhead ?? 1.5;
				for (const { agent, force, dx, dy } of walkers) {
					agent.maxSpeed = v.maxSpeed ?? 2;
					agent.maxForce = v.maxForce ?? 6;
					// Straight on along its stream
					ahead.x = agent.position.x + dx * 3;
					ahead.y = agent.position.y + dy * 3;
					seek(agent, ahead, cruise);
					if (v.mode === 1) Object.assign(force, cruise);
					else
						prioritize(
							force,
							agent.maxForce,
							avoidCollisions(agent, crowd, options, dodge),
							cruise,
						);
					step(agent, force, dt);
					wrap(agent.position, w);
				}
				if (mode !== (v.mode ?? 0)) {
					mode = v.mode ?? 0;
					bumps = 0;
				}
				next.clear();
				for (let i = 0; i < walkers.length; i++) {
					for (let j = i + 1; j < walkers.length; j++) {
						const a = (walkers[i] as Walker).agent.position;
						const b = (walkers[j] as Walker).agent.position;
						const dx = a.x - b.x;
						const dy = a.y - b.y;
						if (Math.hypot(dx, dy) > 2 * options.radius) continue;
						const pair = i * walkers.length + j;
						next.add(pair);
						if (!touching.has(pair)) bumps++;
					}
				}
				[touching, next] = [next, touching];
			},
			draw(d, v, w) {
				d.circle(w.pointer, options.radius, d.colors.target, d.colors.zone);
				d.target(w.pointer);
				walkers.forEach(({ agent, force }, i) => {
					d.circle(
						agent.position,
						options.radius,
						d.colors.muted,
						undefined,
						[2, 2],
					);
					d.agent(agent, i === 0 ? d.colors.agent : d.colors.muted, 8);
					if (i === 0) d.vectors(agent, force);
				});
				d.text(
					vec(d.px(12), d.px(36)),
					`avoidance ${v.mode === 1 ? "off" : "on"} · ${bumps} bumps since switched`,
					d.colors.muted,
				);
			},
		};
	},
};
