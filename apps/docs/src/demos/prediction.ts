import {
	type Agent,
	arrive,
	blend,
	evade,
	type Mover,
	pursue,
	seek,
	step,
	type Vec3,
} from "steerkit";
import { agentCode, type Demo, n, vec } from "../demo.ts";
import { type Draw, Trail } from "../draw.ts";
import { page } from "../pages.ts";

// Where steerkit predicts `other` will be, for drawing (the same formula as
// pursue and evade)
const predicted = (
	agent: Agent,
	other: Mover,
	maxPrediction: number,
	out: Vec3,
): Vec3 => {
	const { position: q, velocity: v } = other;
	const p = agent.position;
	const t = Math.min(
		Math.hypot(q.x - p.x, q.y - p.y) / (agent.maxSpeed + Math.hypot(v.x, v.y)),
		maxPrediction,
	);
	out.x = q.x + v.x * t;
	out.y = q.y + v.y * t;
	return out;
};

const drawPrediction = (d: Draw, from: Vec3, to: Vec3) => {
	d.line(from, to, d.colors.muted, 1.5, [3, 4]);
	d.circle(to, d.px(6), d.colors.muted);
};

export const pursueDemo: Demo = {
	...page("pursue"),
	hint: "The quarry follows the pointer",
	params: [
		{ key: "mode", label: "hunter", value: 0, options: ["pursue", "seek"] },
		{
			key: "maxPrediction",
			label: "maxPrediction",
			value: 2,
			min: 0,
			max: 4,
			step: 0.1,
		},
		{
			key: "maxSpeed",
			label: "hunter maxSpeed",
			value: 3.2,
			min: 0.5,
			max: 8,
			step: 0.1,
		},
		{
			key: "maxForce",
			label: "hunter maxForce",
			value: 5,
			min: 0.5,
			max: 20,
			step: 0.1,
		},
	],
	code: (v) =>
		v.mode === 1
			? `${agentCode(v)}\n\n// Every frame\nseek(hunter, quarry.position, force);\nstep(hunter, force, dt);`
			: `${agentCode(v).replace("agent", "hunter")}\n\n// Every frame: quarry is any { position, velocity }\npursue(hunter, quarry, { maxPrediction: ${n(v.maxPrediction ?? 0)} }, force);\nstep(hunter, force, dt);`,
	create: (world) => {
		const quarry: Agent = {
			position: vec(world.width / 2, world.height / 2),
			velocity: vec(),
			maxSpeed: 2.6,
			maxForce: 6,
		};
		const hunter: Agent = {
			position: vec(0.5, 0.5),
			velocity: vec(),
			maxSpeed: 3.2,
			maxForce: 5,
		};
		const quarryForce = vec();
		const force = vec();
		const ahead = vec();
		const options = { maxPrediction: 2 };
		const slowing = { slowingDistance: 1.5 };
		const quarryTrail = new Trail();
		const hunterTrail = new Trail();
		return {
			update(dt, v, w) {
				arrive(quarry, w.pointer, slowing, quarryForce);
				step(quarry, quarryForce, dt);
				hunter.maxSpeed = v.maxSpeed ?? 3.2;
				hunter.maxForce = v.maxForce ?? 5;
				options.maxPrediction = v.maxPrediction ?? 2;
				if (v.mode === 1) seek(hunter, quarry.position, force);
				else pursue(hunter, quarry, options, force);
				step(hunter, force, dt);
				quarryTrail.push(quarry.position, dt);
				hunterTrail.push(hunter.position, dt);
			},
			draw(d, v) {
				d.trail(quarryTrail.points);
				d.trail(hunterTrail.points);
				if (v.mode !== 1) {
					predicted(hunter, quarry, v.maxPrediction ?? 2, ahead);
					drawPrediction(d, quarry.position, ahead);
				}
				d.agent(quarry, d.colors.target);
				d.agent(hunter);
				d.vectors(hunter, force);
			},
		};
	},
};

export const evadeDemo: Demo = {
	...page("evade"),
	hint: "Sweep the pointer across the crowd",
	params: [
		{
			key: "maxPrediction",
			label: "maxPrediction",
			value: 1,
			min: 0,
			max: 3,
			step: 0.1,
		},
		{
			key: "weight",
			label: "evade weight",
			value: 0.5,
			min: 0,
			max: 3,
			step: 0.05,
		},
		{
			key: "maxSpeed",
			label: "maxSpeed",
			value: 3,
			min: 0.5,
			max: 8,
			step: 0.1,
		},
		{
			key: "maxForce",
			label: "maxForce",
			value: 8,
			min: 0.5,
			max: 20,
			step: 0.1,
		},
	],
	code: (v) =>
		`${agentCode(v)}\n\n// Every frame: threat is any { position, velocity }\nblend(force,\n\t[arrive(agent, home, { slowingDistance: 2 }, goal), 1],\n\t[evade(agent, threat, { maxPrediction: ${n(v.maxPrediction ?? 0)} }, away), ${n(v.weight ?? 0)}],\n);\nstep(agent, force, dt);`,
	create: (world) => {
		const crowd: { agent: Agent; home: Vec3; force: Vec3 }[] = [];
		const cx = world.width / 2;
		const cy = world.height / 2;
		for (let i = 0; i < 7; i++) {
			const angle = (i / 7) * Math.PI * 2;
			const home = vec(cx + Math.cos(angle) * 2.8, cy + Math.sin(angle) * 2.8);
			crowd.push({
				agent: {
					position: vec(home.x, home.y),
					velocity: vec(),
					maxSpeed: 3,
					maxForce: 8,
				},
				home,
				force: vec(),
			});
		}
		const threat: Mover = { position: vec(), velocity: vec() };
		const goal = vec();
		const away = vec();
		const ahead = vec();
		const options = { maxPrediction: 1 };
		const slowing = { slowingDistance: 2 };
		return {
			update(dt, v, w) {
				threat.position = w.pointer;
				threat.velocity = w.pointerVelocity;
				options.maxPrediction = v.maxPrediction ?? 1;
				for (const { agent, home, force } of crowd) {
					agent.maxSpeed = v.maxSpeed ?? 3;
					agent.maxForce = v.maxForce ?? 8;
					blend(
						force,
						[arrive(agent, home, slowing, goal), 1],
						[evade(agent, threat, options, away), v.weight ?? 0.5],
					);
					step(agent, force, dt);
				}
			},
			draw(d, v, w) {
				d.target(w.pointer);
				for (const { agent, home, force } of crowd) {
					predicted(agent, threat, v.maxPrediction ?? 1, ahead);
					d.dot(home, d.colors.trail, 3);
					d.agent(agent);
					d.vectors(agent, force);
				}
				drawPrediction(d, w.pointer, ahead);
			},
		};
	},
};
