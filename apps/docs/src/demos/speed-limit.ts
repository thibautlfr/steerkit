import { type Agent, seek, step, type Vec3 } from "steerkit";
import { type Demo, n, vec } from "../demo.ts";
import { page } from "../pages.ts";

// Seconds of speed history in the chart
const HISTORY = 6;

type Runner = {
	agent: Agent;
	force: Vec3;
	carrot: Vec3;
	lane: number;
	speeds: number[];
};

export const speedLimitDemo: Demo = {
	...page("speed-limit"),
	hint: "The chart shows both speeds over time",
	params: [
		{
			key: "damping",
			label: "overspeedDamping (s)",
			value: 0.6,
			min: 0.05,
			max: 2,
			step: 0.05,
		},
		{
			key: "boost",
			label: "boosted maxSpeed",
			value: 7,
			min: 3,
			max: 10,
			step: 0.1,
		},
	],
	code: (v) =>
		`// The boost ends: maxSpeed drops from ${n(v.boost ?? 0)} to 3\nagent.maxSpeed = 3;\n\n// Every frame\nseek(agent, target, force);\nstep(agent, force, dt, { overspeedDamping: ${n(v.damping ?? 0)} });`,
	create: () => {
		const runners: Runner[] = [0, 1].map((lane) => ({
			agent: {
				position: vec(1, 1),
				velocity: vec(),
				maxSpeed: 3,
				maxForce: 12,
			},
			force: vec(),
			carrot: vec(),
			lane,
			speeds: [],
		}));
		const soft = { overspeedDamping: 0.6 };
		let sampled = 0;
		return {
			update(dt, v, w) {
				// Boosted 2 s out of every 5
				const boosted = w.time % 5 < 2;
				soft.overspeedDamping = v.damping ?? 0.6;
				sampled += dt;
				const sample = sampled > 1 / 30;
				if (sample) sampled = 0;
				for (const runner of runners) {
					const { agent, force, carrot, lane } = runner;
					agent.maxSpeed = boosted ? (v.boost ?? 7) : 3;
					// A carrot running ahead on the lane, left to right
					const y = w.height * (lane === 0 ? 0.22 : 0.52);
					carrot.x = agent.position.x + 1.5;
					carrot.y = y;
					seek(agent, carrot, force);
					if (lane === 0) step(agent, force, dt);
					else step(agent, force, dt, soft);
					if (agent.position.x > w.width + 0.5) agent.position.x = -0.5;
					if (sample) {
						runner.speeds.push(Math.hypot(agent.velocity.x, agent.velocity.y));
						if (runner.speeds.length > HISTORY * 30) runner.speeds.shift();
					}
				}
			},
			draw(d, v, w) {
				const chartTop = w.height * 0.68;
				const chartHeight = w.height * 0.26;
				const top = Math.max(v.boost ?? 7, 3) + 0.5;
				const colors = [d.colors.velocity, d.colors.steering];
				const x = (i: number) => 0.5 + (i / (HISTORY * 30)) * (w.width - 1);
				const y = (speed: number) => chartTop + chartHeight * (1 - speed / top);
				d.line(
					vec(0.5, y(3)),
					vec(w.width - 0.5, y(3)),
					d.colors.muted,
					1,
					[4, 4],
				);
				d.line(vec(0.5, y(0)), vec(w.width - 0.5, y(0)), d.colors.trail, 1);
				for (const { agent, force, lane, speeds } of runners) {
					const color = colors[lane] ?? d.colors.agent;
					const laneY = w.height * (lane === 0 ? 0.22 : 0.52);
					d.line(vec(0, laneY), vec(w.width, laneY), d.colors.trail, 1, [6, 6]);
					d.agent(agent, color);
					d.vectors(agent, force);
					const { ctx } = d;
					ctx.strokeStyle = color;
					ctx.lineWidth = d.px(2);
					ctx.beginPath();
					speeds.forEach((speed, i) => {
						if (i === 0) ctx.moveTo(x(i), y(speed));
						else ctx.lineTo(x(i), y(speed));
					});
					ctx.stroke();
				}
			},
		};
	},
};
