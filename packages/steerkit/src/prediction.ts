import type { Agent, Mover, Vec3 } from "./types.ts";
import { desire, distance, length } from "./vec.ts";

export type PredictionOptions = {
	/** Cap on how far ahead to predict, in seconds. Unbounded when not given. */
	maxPrediction?: number;
};

// How long until `other` is reached: the time the two would take to meet
// head-on, so a far quarry is predicted further ahead than a near one. No
// prediction when they'd never meet (both still)
const lookAhead = (
	agent: Agent,
	other: Mover,
	maxPrediction: number | undefined,
): number => {
	const t = Math.min(
		distance(agent.position, other.position) /
			(agent.maxSpeed + length(other.velocity)),
		maxPrediction ?? Infinity,
	);
	return t < Infinity ? t : 0;
};

/** Seek where `quarry` will be, not where it is: an interception. */
export function pursue(
	agent: Agent,
	quarry: Mover,
	{ maxPrediction }: PredictionOptions,
	out: Vec3,
): Vec3 {
	const t = lookAhead(agent, quarry, maxPrediction);
	const { position: q, velocity: v } = quarry;
	const p = agent.position;
	return desire(
		agent,
		q.x + v.x * t - p.x,
		q.y + v.y * t - p.y,
		q.z + v.z * t - p.z,
		agent.maxSpeed,
		out,
	);
}

/** Flee where `threat` will be, not where it is: dodging a pursuer. */
export function evade(
	agent: Agent,
	threat: Mover,
	{ maxPrediction }: PredictionOptions,
	out: Vec3,
): Vec3 {
	const t = lookAhead(agent, threat, maxPrediction);
	const { position: q, velocity: v } = threat;
	const p = agent.position;
	return desire(
		agent,
		p.x - (q.x + v.x * t),
		p.y - (q.y + v.y * t),
		p.z - (q.z + v.z * t),
		agent.maxSpeed,
		out,
	);
}
