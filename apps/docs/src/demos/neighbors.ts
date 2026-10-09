import {
	type Agent,
	add,
	alignment,
	blend,
	cohesion,
	createGrid,
	createNeighbors,
	createWanderState,
	keepAway,
	type NeighborhoodOptions,
	queryGrid,
	separation,
	step,
	updateGrid,
	type Vec3,
	type WanderState,
	wander,
	zero,
} from "steerkit";
import { type Demo, n, type Values, vec, wrap } from "../demo.ts";
import type { Draw } from "../draw.ts";
import { page } from "../pages.ts";

type Behavior = typeof separation;

type Member = {
	agent: Agent;
	state: WanderState;
	force: Vec3;
	roam: Vec3;
	react: Vec3;
};

const DEGREES = Math.PI / 180;

const wandering = { radius: 1, distance: 2, jitter: 2, plane: "xy" } as const;

// Whether `agent` sees `other`, as the group behaviors decide, for drawing
const sees = (
	agent: Agent,
	other: Agent,
	{ radius, fieldOfView = Math.PI * 2 }: NeighborhoodOptions,
): boolean => {
	if (other === agent) return false;
	const dx = other.position.x - agent.position.x;
	const dy = other.position.y - agent.position.y;
	const d = Math.hypot(dx, dy);
	if (d > radius) return false;
	const v = agent.velocity;
	const speed = Math.hypot(v.x, v.y);
	if (fieldOfView >= Math.PI * 2 || speed === 0 || d === 0) return true;
	return (v.x * dx + v.y * dy) / (speed * d) >= Math.cos(fieldOfView / 2);
};

// The neighborhood of `agent`, and lines to the neighbors it sees
const drawNeighborhood = (
	d: Draw,
	agent: Agent,
	others: readonly Agent[],
	options: NeighborhoodOptions,
) => {
	const { position: p, velocity: v } = agent;
	d.sector(
		p,
		options.radius,
		Math.atan2(v.y, v.x),
		options.fieldOfView ?? Math.PI * 2,
		d.colors.muted,
		d.colors.zone,
	);
	for (const other of others) {
		if (sees(agent, other, options))
			d.line(p, other.position, d.colors.target, 1.5);
	}
};

// The options line of the code, without the field of view when it's all
// around (the default)
const neighborhoodCode = (v: Values): string => {
	const fov = v.fieldOfView ?? 360;
	return fov >= 360
		? `{ radius: ${n(v.radius ?? 0)} }`
		: `{ radius: ${n(v.radius ?? 0)}, fieldOfView: ${n(fov * DEGREES)} }`;
};

// A crowd that wanders and reacts to its neighbors with one group behavior
const groupDemo = ({
	id,
	name,
	behavior,
	weight,
	radius,
	fieldOfView,
	start,
}: {
	id: string;
	name: string;
	behavior: Behavior;
	weight: number;
	radius: number;
	fieldOfView: number;
	/** Where the agents start: spread out, or clumped in the middle. */
	start: "spread" | "clumped";
}): Demo => ({
	...page(id),
	hint: "The highlighted agent shows what it sees",
	params: [
		{
			key: "weight",
			label: `${name} weight`,
			value: weight,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "radius",
			label: "radius",
			value: radius,
			min: 0.3,
			max: 4,
			step: 0.1,
		},
		{
			key: "fieldOfView",
			label: "fieldOfView (°)",
			value: fieldOfView,
			min: 30,
			max: 360,
			step: 10,
		},
	],
	code: (v) =>
		`// Every frame, for each agent. crowd is the list of all agents,\n// the agent itself included: ${name} ignores it\nblend(force,\n\t[wander(agent, state, { radius: 1, distance: 2, jitter: 2, plane: "xy" }, dt, roam), 1],\n\t[${name}(agent, crowd, ${neighborhoodCode(v)}, react), ${n(v.weight ?? 0)}],\n);\nstep(agent, force, dt);`,
	create: (world) => {
		const members: Member[] = [];
		for (let i = 0; i < 40; i++) {
			const angle = Math.random() * Math.PI * 2;
			const r = start === "clumped" ? Math.random() * 1.2 : 0;
			members.push({
				agent: {
					position:
						start === "clumped"
							? vec(
									world.width / 2 + Math.cos(angle) * r,
									world.height / 2 + Math.sin(angle) * r,
								)
							: vec(Math.random() * world.width, Math.random() * world.height),
					velocity: vec(Math.cos(angle) * 1.5, Math.sin(angle) * 1.5),
					maxSpeed: 2,
					maxForce: 3,
				},
				state: createWanderState(),
				force: vec(),
				roam: vec(),
				react: vec(),
			});
		}
		const crowd = members.map((m) => m.agent);
		const options: { radius: number; fieldOfView: number } = {
			radius,
			fieldOfView: fieldOfView * DEGREES,
		};
		return {
			update(dt, v, w) {
				options.radius = v.radius ?? radius;
				options.fieldOfView = (v.fieldOfView ?? fieldOfView) * DEGREES;
				for (const { agent, state, force, roam, react } of members) {
					blend(
						force,
						[wander(agent, state, wandering, dt, roam), 1],
						[behavior(agent, crowd, options, react), v.weight ?? weight],
					);
					step(agent, force, dt);
					wrap(agent.position, w);
				}
			},
			draw(d) {
				const [lead, ...rest] = members;
				if (!lead) return;
				drawNeighborhood(d, lead.agent, crowd, options);
				for (const { agent } of rest) d.agent(agent, d.colors.muted, 8);
				d.agent(lead.agent);
				d.vectors(lead.agent, lead.force);
			},
		};
	},
});

export const separationDemo = groupDemo({
	id: "separation",
	name: "separation",
	behavior: separation,
	weight: 2,
	radius: 1.2,
	fieldOfView: 360,
	start: "clumped",
});

export const cohesionDemo = groupDemo({
	id: "cohesion",
	name: "cohesion",
	behavior: cohesion,
	weight: 1.5,
	radius: 2,
	fieldOfView: 360,
	start: "spread",
});

export const alignmentDemo = groupDemo({
	id: "alignment",
	name: "alignment",
	behavior: alignment,
	weight: 2,
	radius: 2,
	fieldOfView: 270,
	start: "spread",
});

// How many boids at most, and the radius they see their flockmates within
const MAX_BOIDS = 1000;

export const flockingDemo: Demo = {
	...page("flocking"),
	hint: "Scare the flock with the pointer",
	params: [
		{
			key: "count",
			label: "boids",
			value: 200,
			min: 50,
			max: MAX_BOIDS,
			step: 50,
		},
		{
			key: "mode",
			label: "neighbors",
			value: 0,
			options: ["spatial grid", "whole crowd"],
		},
		{
			key: "separation",
			label: "separation weight",
			value: 1.5,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "alignment",
			label: "alignment weight",
			value: 1,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "cohesion",
			label: "cohesion weight",
			value: 1,
			min: 0,
			max: 4,
			step: 0.05,
		},
		{
			key: "radius",
			label: "radius",
			value: 1.2,
			min: 0.4,
			max: 3,
			step: 0.1,
		},
	],
	code: (v) => {
		const radius = n(v.radius ?? 0);
		const near = `{ radius: ${radius} }`;
		const close = `{ radius: ${n((v.radius ?? 0) / 2)} }`;
		const body = `\tzero(force);\n\tadd(force, separation(boid, neighbors, ${close}, tmp), ${n(v.separation ?? 0)});\n\tadd(force, alignment(boid, neighbors, ${near}, tmp), ${n(v.alignment ?? 0)});\n\tadd(force, cohesion(boid, neighbors, ${near}, tmp), ${n(v.cohesion ?? 0)});\n\tadd(force, keepAway(boid, pointer, { radius: 2 }, tmp), 4);\n\tstep(boid, force, dt);\n}`;
		return v.mode === 1
			? `// Every frame: each boid scans the whole crowd (n² checks)\nfor (const boid of boids) {\n\tconst neighbors = boids;\n${body}`
			: `const grid = createGrid({ cellSize: ${radius}, plane: "xy" });\nconst near = createNeighbors(); // reused by every query\n\n// Every frame: sort the boids into cells, then ask each one's neighbors\nupdateGrid(grid, boids);\nfor (const boid of boids) {\n\tconst neighbors = queryGrid(grid, boid.position, ${radius}, near);\n${body}`;
	},
	create: (world) => {
		const boids: Agent[] = [];
		const spawn = () => {
			const angle = Math.random() * Math.PI * 2;
			boids.push({
				position: vec(
					Math.random() * world.width,
					Math.random() * world.height,
				),
				velocity: vec(Math.cos(angle) * 2, Math.sin(angle) * 2),
				maxSpeed: 2.5,
				maxForce: 4,
			});
		};
		let cellSize = 0;
		let grid = createGrid<Agent>({ cellSize: 1, plane: "xy" });
		const near = createNeighbors<Agent>();
		const close = { radius: 0.6 };
		const around = { radius: 1.2 };
		const scared = { radius: 2 };
		const force = vec();
		const tmp = vec();
		// The first boid's force, to draw its vectors
		const shown = vec();
		// The steering time per frame, smoothed, and when it was last shown
		let ms = 0;
		return {
			update(dt, v, w) {
				const count = v.count ?? 200;
				while (boids.length < count) spawn();
				boids.length = Math.min(boids.length, count);
				around.radius = v.radius ?? 1.2;
				close.radius = around.radius / 2;
				if (cellSize !== around.radius) {
					cellSize = around.radius;
					grid = createGrid<Agent>({ cellSize, plane: "xy" });
				}
				const useGrid = v.mode !== 1;

				const start = performance.now();
				if (useGrid) updateGrid(grid, boids);
				for (let i = 0; i < boids.length; i++) {
					const boid = boids[i] as Agent;
					const neighbors = useGrid
						? queryGrid(grid, boid.position, around.radius, near)
						: boids;
					zero(force);
					add(
						force,
						separation(boid, neighbors, close, tmp),
						v.separation ?? 1.5,
					);
					add(force, alignment(boid, neighbors, around, tmp), v.alignment ?? 1);
					add(force, cohesion(boid, neighbors, around, tmp), v.cohesion ?? 1);
					add(force, keepAway(boid, w.pointer, scared, tmp), 4);
					if (i === 0) Object.assign(shown, force);
					step(boid, force, dt);
					wrap(boid.position, w);
				}
				const elapsed = performance.now() - start;
				ms += (elapsed - ms) * 0.05;
			},
			draw(d, v, w) {
				d.circle(w.pointer, scared.radius, d.colors.target, d.colors.zone);
				d.target(w.pointer);
				const [lead, ...rest] = boids;
				for (const boid of rest) d.agent(boid, d.colors.muted, 6);
				if (lead) {
					d.agent(lead, d.colors.agent, 9);
					d.vectors(lead, shown);
				}
				d.text(
					vec(d.px(12), d.px(36)),
					`${boids.length} boids · ${v.mode === 1 ? "whole crowd" : "grid"} · ${ms.toFixed(2)} ms per frame`,
					d.colors.muted,
				);
			},
		};
	},
};
