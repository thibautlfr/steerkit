import {
	type Agent,
	arrive,
	blend,
	createWanderState,
	keepAway,
	prioritize,
	step,
	type Vec3,
	type WanderState,
	wander,
} from "steerkit";
import { type Demo, n, vec } from "../demo.ts";
import { Trail } from "../draw.ts";
import { page } from "../pages.ts";

type Fairy = {
	agent: Agent;
	state: WanderState;
	force: Vec3;
	roam: Vec3;
	goal: Vec3;
	away: Vec3;
	trail: Trail;
};

export const combineDemo: Demo = {
	...page("combine"),
	hint: "Chase the fairies with the pointer",
	params: [
		{
			key: "mode",
			label: "combinator",
			value: 0,
			options: ["blend", "prioritize"],
		},
		{
			key: "wander",
			label: "wander weight",
			value: 1,
			min: 0,
			max: 3,
			step: 0.05,
		},
		{
			key: "home",
			label: "arrive weight",
			value: 0.8,
			min: 0,
			max: 3,
			step: 0.05,
		},
		{
			key: "away",
			label: "keepAway weight",
			value: 3,
			min: 0,
			max: 6,
			step: 0.05,
		},
		{
			key: "radius",
			label: "keepAway radius",
			value: 2,
			min: 0.2,
			max: 5,
			step: 0.1,
		},
	],
	code: (v) =>
		v.mode === 1
			? `// Every frame, in order of priority, within maxForce\nprioritize(force, fairy.maxForce,\n\tkeepAway(fairy, pointer, { radius: ${n(v.radius ?? 0)} }, away),\n\tarrive(fairy, center, { slowingDistance: 3 }, goal),\n\twander(fairy, state, { radius: 1, distance: 2, jitter: 3 }, dt, roam),\n);\nstep(fairy, force, dt);`
			: `// Every frame\nblend(force,\n\t[wander(fairy, state, { radius: 1, distance: 2, jitter: 3 }, dt, roam), ${n(v.wander ?? 0)}],\n\t[arrive(fairy, center, { slowingDistance: 3 }, goal), ${n(v.home ?? 0)}],\n\t[keepAway(fairy, pointer, { radius: ${n(v.radius ?? 0)} }, away), ${n(v.away ?? 0)}],\n);\nstep(fairy, force, dt);`,
	create: (world) => {
		const fairies: Fairy[] = [];
		for (let i = 0; i < 9; i++) {
			fairies.push({
				agent: {
					position: vec(
						world.width / 2 + (Math.random() - 0.5) * 4,
						world.height / 2 + (Math.random() - 0.5) * 4,
					),
					velocity: vec(),
					maxSpeed: 2.8,
					maxForce: 5,
				},
				state: createWanderState(),
				force: vec(),
				roam: vec(),
				goal: vec(),
				away: vec(),
				trail: new Trail(40),
			});
		}
		const center = vec();
		const wandering = {
			radius: 1,
			distance: 2,
			jitter: 3,
			plane: "xy",
		} as const;
		const slowing = { slowingDistance: 3 };
		const around = { radius: 2 };
		return {
			update(dt, v, w) {
				center.x = w.width / 2;
				center.y = w.height / 2;
				around.radius = v.radius ?? 2;
				for (const fairy of fairies) {
					const { agent, state, force, roam, goal, away } = fairy;
					if (v.mode === 1) {
						prioritize(
							force,
							agent.maxForce,
							keepAway(agent, w.pointer, around, away),
							arrive(agent, center, slowing, goal),
							wander(agent, state, wandering, dt, roam),
						);
					} else {
						blend(
							force,
							[wander(agent, state, wandering, dt, roam), v.wander ?? 1],
							[arrive(agent, center, slowing, goal), v.home ?? 0.8],
							[keepAway(agent, w.pointer, around, away), v.away ?? 3],
						);
					}
					step(agent, force, dt);
					fairy.trail.push(agent.position, dt);
				}
			},
			draw(d, v, w) {
				d.circle(w.pointer, v.radius ?? 2, d.colors.target, d.colors.zone);
				d.target(w.pointer);
				for (const { agent, force, trail } of fairies) {
					d.trail(trail.points);
					d.agent(agent);
					d.vectors(agent, force);
				}
			},
		};
	},
};
