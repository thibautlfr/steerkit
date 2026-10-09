/**
 * Craig Reynolds' steering behaviors for autonomous characters (GDC 1999,
 * red3d.com/cwr/steer/gdc99). Each behavior turns a goal into a steering
 * force, `desired velocity − velocity`, written into the `out` vector you
 * pass and returned; combinators weigh several forces together; `step` moves
 * the agent. Engine-agnostic: any `{ x, y, z }` works, `THREE.Vector3`
 * included, and nothing is allocated per frame.
 *
 * @packageDocumentation
 */

export { arrive, brake, flee, keepAway, seek } from "./basic.ts";
export {
	add,
	addWithin,
	blend,
	prioritize,
	zero,
} from "./combine.ts";
export {
	createGrid,
	createNeighbors,
	type Grid,
	type GridOptions,
	type Neighbors,
	queryGrid,
	updateGrid,
} from "./grid.ts";
export {
	alignment,
	cohesion,
	type NeighborhoodOptions,
	separation,
} from "./neighbors.ts";
export { evade, type PredictionOptions, pursue } from "./prediction.ts";
export { type StepOptions, step } from "./step.ts";
export type { Agent, Mover, Plane, Term, Vec3 } from "./types.ts";
export {
	createWanderState,
	type WanderOptions,
	type WanderState,
	wander,
} from "./wander.ts";
