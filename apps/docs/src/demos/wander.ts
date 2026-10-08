import {
	type Agent,
	createWanderState,
	step,
	type WanderOptions,
	type WanderState,
	wander,
} from "steerkit";
import { agentCode, agentParams, type Demo, n, vec, wrap } from "../demo.ts";
import { Trail } from "../draw.ts";

export const wanderDemo: Demo = {
	id: "wander",
	title: "Wander",
	summary:
		"A random walk that looks natural. The agent seeks a point on a circle ahead of it (dashed), and that point drifts a little at random every frame, so the heading changes in smooth curves instead of trembling. A larger radius turns sharper, a longer distance smoother, a higher jitter more often. In 3D, the circle is a sphere; here it's kept in the xy plane.",
	hint: "Tweak the circle with the sliders",
	params: [
		...agentParams(2.5, 3),
		{ key: "radius", label: "radius", value: 1, min: 0.1, max: 3, step: 0.05 },
		{ key: "distance", label: "distance", value: 2, min: 0, max: 5, step: 0.1 },
		{ key: "jitter", label: "jitter", value: 2, min: 0, max: 8, step: 0.1 },
	],
	code: (v) =>
		`${agentCode(v)}\nconst state = createWanderState(); // one per agent\n\n// Every frame\nwander(agent, state, {\n\tradius: ${n(v.radius ?? 0)}, distance: ${n(v.distance ?? 0)}, jitter: ${n(v.jitter ?? 0)},\n\tplane: "xy",\n}, dt, force);\nstep(agent, force, dt);`,
	create: (world) => {
		const flock: {
			agent: Agent;
			state: WanderState;
			force: ReturnType<typeof vec>;
		}[] = [];
		for (let i = 0; i < 16; i++) {
			const angle = Math.random() * Math.PI * 2;
			flock.push({
				agent: {
					position: vec(
						Math.random() * world.width,
						Math.random() * world.height,
					),
					velocity: vec(Math.cos(angle), Math.sin(angle)),
					maxSpeed: 2.5,
					maxForce: 3,
				},
				state: createWanderState(),
				force: vec(),
			});
		}
		const options: WanderOptions = {
			radius: 1,
			distance: 2,
			jitter: 2,
			plane: "xy",
		};
		const trail = new Trail(150);
		return {
			update(dt, v, w) {
				options.radius = v.radius ?? 1;
				options.distance = v.distance ?? 2;
				options.jitter = v.jitter ?? 2;
				for (const { agent, state, force } of flock) {
					agent.maxSpeed = v.maxSpeed ?? 2.5;
					agent.maxForce = v.maxForce ?? 3;
					wander(agent, state, options, dt, force);
					step(agent, force, dt);
					wrap(agent.position, w);
				}
				const lead = flock[0];
				if (lead) trail.push(lead.agent.position, dt);
			},
			draw(d) {
				d.trail(trail.points);
				flock.forEach(({ agent, state, force }, i) => {
					if (i === 0) {
						// The wander circle and its point, ahead of the agent
						const { position: p } = agent;
						const { heading: h, offset: o } = state;
						const center = vec(
							p.x + h.x * options.distance,
							p.y + h.y * options.distance,
						);
						const point = vec(
							center.x + o.x * options.radius,
							center.y + o.y * options.radius,
						);
						d.line(p, center, d.colors.muted, 1, [2, 3]);
						d.circle(center, options.radius, d.colors.muted, undefined, [4, 4]);
						d.dot(point, d.colors.target, 4);
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
