import type { Vec3 } from "steerkit";
import type { Draw } from "./draw.ts";
import type { Page } from "./pages.ts";

/** A slider, or a choice when `options` is given. */
export type Param = {
	key: string;
	label: string;
	value: number;
	min?: number;
	max?: number;
	step?: number;
	options?: string[];
};

export type Values = Record<string, number>;

/** What the stage hands a scene every frame, in world units (y down). */
export type World = {
	width: number;
	height: number;
	/** The pointer over the canvas, or a target moving on its own. */
	pointer: Vec3;
	/** How fast the pointer moves, smoothed: a threat to predict. */
	pointerVelocity: Vec3;
	/** Whether the pointer is over the canvas. */
	pointing: boolean;
	time: number;
};

export type Scene = {
	update: (dt: number, values: Values, world: World) => void;
	draw: (draw: Draw, values: Values, world: World) => void;
};

export type Demo = Page & {
	hint: string;
	params: Param[];
	/** The calls this demo makes, with the current values. */
	code: (values: Values) => string;
	create: (world: World) => Scene;
};

/** A 3D demo, once loaded: it runs its own frame loop. */
export type Player = {
	/** Whether the forces are drawn. */
	vectors: boolean;
	stop: () => void;
};

/**
 * A Three.js demo, loaded on demand so the other pages don't download
 * three. Its sliders write into `values`, which it reads every frame.
 */
export type Demo3D = Page & {
	hint: string;
	params: Param[];
	code: (values: Values) => string;
	load: () => Promise<{
		play: (canvas: HTMLCanvasElement, values: Values) => Player;
	}>;
};

export const vec = (x = 0, y = 0, z = 0): Vec3 => ({ x, y, z });

// Rounds a slider value for display in code
export const n = (value: number): string =>
	String(Math.round(value * 100) / 100);

// The agent fields every demo exposes as sliders
export const agentParams = (maxSpeed = 3, maxForce = 4): Param[] => [
	{
		key: "maxSpeed",
		label: "maxSpeed",
		value: maxSpeed,
		min: 0.5,
		max: 8,
		step: 0.1,
	},
	{
		key: "maxForce",
		label: "maxForce",
		value: maxForce,
		min: 0.5,
		max: 20,
		step: 0.1,
	},
];

export const agentCode = (values: Values): string =>
	`const agent = {\n\tposition, velocity,\n\tmaxSpeed: ${n(values.maxSpeed ?? 0)},\n\tmaxForce: ${n(values.maxForce ?? 0)},\n};`;

// Wraps a position around the edges of the world
export const wrap = (p: Vec3, world: World): void => {
	p.x = ((p.x % world.width) + world.width) % world.width;
	p.y = ((p.y % world.height) + world.height) % world.height;
};
