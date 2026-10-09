import {
	type Agent,
	blend,
	createWanderState,
	type FlowField,
	type FollowPathOptions,
	followFlow,
	followPath,
	prioritize,
	type StayWithinOptions,
	separation,
	stayWithin,
	step,
	type Vec3,
	type WanderState,
	wander,
} from "steerkit";
import { agentCode, agentParams, type Demo, n, vec, wrap } from "../demo.ts";
import type { Draw } from "../draw.ts";
import { page } from "../pages.ts";

const wandering = { radius: 1, distance: 1.5, jitter: 3, plane: "xy" } as const;

// A rectangle's outline, from two corners
const rectangle = (d: Draw, min: Vec3, max: Vec3, dash: number[]) => {
	const corners = [
		vec(min.x, min.y),
		vec(max.x, min.y),
		vec(max.x, max.y),
		vec(min.x, max.y),
	];
	corners.forEach((corner, i) => {
		d.line(corner, corners[(i + 1) % 4] as Vec3, d.colors.muted, 1.5, dash);
	});
};

export const containmentDemo: Demo = {
	...page("containment"),
	hint: "Tweak the margin with the sliders",
	params: [
		...agentParams(2.5, 5),
		{
			key: "margin",
			label: "margin",
			value: 0.6,
			min: 0,
			max: 2,
			step: 0.05,
		},
		{
			key: "lookAhead",
			label: "lookAhead (s)",
			value: 0.5,
			min: 0,
			max: 2,
			step: 0.05,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n// Any { min, max }: THREE.Box3 as is. No depth in 2D\nconst box = { min: { x: 1, y: 1, z: 0 }, max: { x: 9, y: 9, z: 0 } };\n\n// Every frame, the walls first\nprioritize(force, agent.maxForce,\n\tstayWithin(agent, box, { margin: ${n(v.margin ?? 0)}, lookAhead: ${n(v.lookAhead ?? 0)} }, inside),\n\twander(agent, state, { radius: 1, distance: 1.5, jitter: 3, plane: "xy" }, dt, roam),\n);\nstep(agent, force, dt);`,
	create: (world) => {
		const box = {
			min: vec(world.width * 0.15, world.height * 0.15),
			max: vec(world.width * 0.85, world.height * 0.85),
		};
		const members: { agent: Agent; state: WanderState; force: Vec3 }[] = [];
		for (let i = 0; i < 12; i++) {
			const angle = Math.random() * Math.PI * 2;
			members.push({
				agent: {
					position: vec(
						box.min.x + Math.random() * (box.max.x - box.min.x),
						box.min.y + Math.random() * (box.max.y - box.min.y),
					),
					velocity: vec(Math.cos(angle) * 2, Math.sin(angle) * 2),
					maxSpeed: 2.5,
					maxForce: 5,
				},
				state: createWanderState(),
				force: vec(),
			});
		}
		const options: StayWithinOptions = { margin: 0.6, lookAhead: 0.5 };
		const inside = vec();
		const roam = vec();
		return {
			update(dt, v) {
				options.margin = v.margin ?? 0.6;
				options.lookAhead = v.lookAhead ?? 0.5;
				for (const { agent, state, force } of members) {
					agent.maxSpeed = v.maxSpeed ?? 2.5;
					agent.maxForce = v.maxForce ?? 5;
					prioritize(
						force,
						agent.maxForce,
						stayWithin(agent, box, options, inside),
						wander(agent, state, wandering, dt, roam),
					);
					step(agent, force, dt);
				}
			},
			draw(d) {
				const m = options.margin;
				d.polygon(
					[
						vec(box.min.x, box.min.y),
						vec(box.max.x, box.min.y),
						vec(box.max.x, box.max.y),
						vec(box.min.x, box.max.y),
					],
					d.colors.zone,
				);
				rectangle(d, box.min, box.max, []);
				rectangle(
					d,
					vec(box.min.x + m, box.min.y + m),
					vec(box.max.x - m, box.max.y - m),
					[4, 4],
				);
				members.forEach(({ agent, force }, i) => {
					if (i === 0) {
						// Where the agent will be in lookAhead seconds
						const { position: p, velocity: u } = agent;
						const t = options.lookAhead;
						const future = vec(p.x + u.x * t, p.y + u.y * t);
						d.line(p, future, d.colors.muted, 1, [2, 3]);
						d.dot(future, d.colors.target, 3);
						d.agent(agent);
						d.vectors(agent, force);
					} else {
						d.agent(agent, d.colors.muted, 8);
					}
				});
			},
		};
	},
};

// A wavy loop around the center of the world
const loop = (world: { width: number; height: number }): Vec3[] => {
	const points: Vec3[] = [];
	for (let i = 0; i < 40; i++) {
		const a = (i / 40) * Math.PI * 2;
		const r = 1 + 0.15 * Math.sin(3 * a);
		points.push(
			vec(
				world.width / 2 + Math.cos(a) * world.width * 0.36 * r,
				world.height / 2 + Math.sin(a) * world.height * 0.33 * r,
			),
		);
	}
	return points;
};

export const pathFollowingDemo: Demo = {
	...page("path-following"),
	hint: "Tweak the road with the sliders",
	params: [
		...agentParams(3, 6),
		{
			key: "radius",
			label: "radius",
			value: 0.4,
			min: 0,
			max: 1.2,
			step: 0.05,
		},
		{
			key: "lookAhead",
			label: "lookAhead (s)",
			value: 0.5,
			min: 0.05,
			max: 2,
			step: 0.05,
		},
		{
			key: "separation",
			label: "separation weight",
			value: 1,
			min: 0,
			max: 4,
			step: 0.05,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n// Any list of points: a plain array, or a curve's samples\nconst road = [{ x: 2, y: 5, z: 0 }, …];\n\n// Every frame, for each agent\nblend(force,\n\t[followPath(agent, road, { radius: ${n(v.radius ?? 0)}, lookAhead: ${n(v.lookAhead ?? 0)}, closed: true }, along), 1],\n\t[separation(agent, crowd, { radius: 0.5 }, apart), ${n(v.separation ?? 0)}],\n);\nstep(agent, force, dt);`,
	create: (world) => {
		const road = loop(world);
		const agents: Agent[] = [];
		const forces: Vec3[] = [];
		for (let i = 0; i < 10; i++) {
			agents.push({
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
		const options: FollowPathOptions = {
			radius: 0.4,
			lookAhead: 0.5,
			closed: true,
		};
		const close = { radius: 0.5 };
		const along = vec();
		const apart = vec();
		return {
			update(dt, v) {
				options.radius = v.radius ?? 0.4;
				options.lookAhead = v.lookAhead ?? 0.5;
				agents.forEach((agent, i) => {
					agent.maxSpeed = v.maxSpeed ?? 3;
					agent.maxForce = v.maxForce ?? 6;
					blend(
						forces[i] as Vec3,
						[followPath(agent, road, options, along), 1],
						[separation(agent, agents, close, apart), v.separation ?? 1],
					);
					step(agent, forces[i] as Vec3, dt);
				});
			},
			draw(d) {
				// The road: a band as wide as twice the radius, and its spine
				const { ctx } = d;
				ctx.strokeStyle = d.colors.zone;
				ctx.lineWidth = Math.max(options.radius * 2, d.px(1));
				ctx.lineJoin = "round";
				ctx.beginPath();
				road.forEach((point, i) => {
					if (i === 0) ctx.moveTo(point.x, point.y);
					else ctx.lineTo(point.x, point.y);
				});
				ctx.closePath();
				ctx.stroke();
				road.forEach((point, i) => {
					d.line(
						point,
						road[(i + 1) % road.length] as Vec3,
						d.colors.muted,
						1,
						[4, 4],
					);
				});
				agents.forEach((agent, i) => {
					if (i === 0) {
						const { position: p, velocity: u } = agent;
						const t = options.lookAhead;
						const future = vec(p.x + u.x * t, p.y + u.y * t);
						d.line(p, future, d.colors.muted, 1, [2, 3]);
						d.dot(future, d.colors.target, 3);
						d.agent(agent);
						d.vectors(agent, forces[0] as Vec3);
					} else {
						d.agent(agent, d.colors.muted, 8);
					}
				});
			},
		};
	},
};

// The side of a cell of the flow grid
const CELL = 0.6;

export const flowFieldDemo: Demo = {
	...page("flow-field"),
	hint: "Stir the flow with the pointer",
	params: [
		...agentParams(2.5, 4),
		{
			key: "lookAhead",
			label: "lookAhead (s)",
			value: 0.3,
			min: 0,
			max: 1.5,
			step: 0.05,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n// A grid of directions, x and y in turn, filled by your own logic\nconst size = ${CELL};\nconst flow = new Float32Array(cols * rows * 2);\nconst field = (p, out) => {\n\tconst i = Math.min(cols - 1, Math.max(0, Math.floor(p.x / size)));\n\tconst j = Math.min(rows - 1, Math.max(0, Math.floor(p.y / size)));\n\tconst k = (j * cols + i) * 2;\n\tout.x = flow[k];\n\tout.y = flow[k + 1];\n\tout.z = 0;\n\treturn out;\n};\n\n// Every frame\nfollowFlow(agent, field, { lookAhead: ${n(v.lookAhead ?? 0)} }, force);\nstep(agent, force, dt);`,
	create: (world) => {
		const cols = Math.ceil(world.width / CELL);
		const rows = Math.ceil(world.height / CELL);
		const flow = new Float32Array(cols * rows * 2);
		const field: FlowField = (p, out) => {
			const i = Math.min(cols - 1, Math.max(0, Math.floor(p.x / CELL)));
			const j = Math.min(rows - 1, Math.max(0, Math.floor(p.y / CELL)));
			const k = (j * cols + i) * 2;
			out.x = flow[k] ?? 0;
			out.y = flow[k + 1] ?? 0;
			out.z = 0;
			return out;
		};
		// A slow, smooth current, and a vortex around the pointer
		const fill = (time: number, pointer: Vec3) => {
			for (let j = 0; j < rows; j++) {
				for (let i = 0; i < cols; i++) {
					const x = (i + 0.5) * CELL;
					const y = (j + 0.5) * CELL;
					const angle =
						Math.sin(x * 0.35 + time * 0.2) * 1.4 +
						Math.cos(y * 0.45 - time * 0.15) * 1.4;
					let fx = Math.cos(angle);
					let fy = Math.sin(angle);
					const dx = x - pointer.x;
					const dy = y - pointer.y;
					const d = Math.hypot(dx, dy);
					if (d < 2.5 && d > 0) {
						// Around the pointer, clockwise, fading at the edge
						const k = 1 - d / 2.5;
						fx = fx * (1 - k) - (dy / d) * k;
						fy = fy * (1 - k) + (dx / d) * k;
					}
					flow[(j * cols + i) * 2] = fx;
					flow[(j * cols + i) * 2 + 1] = fy;
				}
			}
		};
		// The current gathers the agents along a few lines: each one starts
		// over somewhere else after a few seconds, so the whole field shows
		const agents: Agent[] = [];
		const ages: number[] = [];
		const respawn = (agent: Agent, w: { width: number; height: number }) => {
			agent.position.x = Math.random() * w.width;
			agent.position.y = Math.random() * w.height;
			agent.velocity.x = 0;
			agent.velocity.y = 0;
		};
		for (let i = 0; i < 120; i++) {
			const agent: Agent = {
				position: vec(),
				velocity: vec(),
				maxSpeed: 2.5,
				maxForce: 4,
			};
			respawn(agent, world);
			agents.push(agent);
			ages.push(Math.random() * 6);
		}
		const options = { lookAhead: 0.3 };
		const force = vec();
		const shown = vec();
		return {
			update(dt, v, w) {
				fill(w.time, w.pointer);
				options.lookAhead = v.lookAhead ?? 0.3;
				agents.forEach((agent, i) => {
					agent.maxSpeed = v.maxSpeed ?? 2.5;
					agent.maxForce = v.maxForce ?? 4;
					// Not the highlighted one, so its vectors stay readable
					ages[i] = (ages[i] ?? 0) + dt;
					if (i > 0 && (ages[i] ?? 0) > 6) {
						ages[i] = Math.random() * 2;
						respawn(agent, w);
					}
					followFlow(agent, field, options, force);
					if (i === 0) Object.assign(shown, force);
					step(agent, force, dt);
					wrap(agent.position, w);
				});
			},
			draw(d) {
				const length = CELL * 0.4;
				for (let j = 0; j < rows; j++) {
					for (let i = 0; i < cols; i++) {
						const k = (j * cols + i) * 2;
						const c = vec((i + 0.5) * CELL, (j + 0.5) * CELL);
						const fx = flow[k] ?? 0;
						const fy = flow[k + 1] ?? 0;
						d.arrow(
							vec(c.x - fx * length, c.y - fy * length),
							vec(c.x + fx * length, c.y + fy * length),
							d.colors.trail,
							2,
						);
					}
				}
				const [lead, ...rest] = agents;
				for (const agent of rest) d.agent(agent, d.colors.muted, 6);
				if (lead) {
					d.agent(lead, d.colors.agent, 9);
					d.vectors(lead, shown);
				}
			},
		};
	},
};
