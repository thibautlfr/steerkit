// Every page of the site: its title, the text crawlers and link previews
// see, and the goal its "Copy prompt" hands to a coding agent. Plain data,
// read by the app and by the build (vite.config.ts) to prerender each page.

export const SITE = "https://steerkit.thibaut-lefrancois.com";

export type Page = {
	id: string;
	title: string;
	/** Shown under the title. */
	summary: string;
	/** The meta description: under 160 characters. */
	description: string;
	/** What "Copy prompt" asks an agent to do, after "Goal:". */
	goal: string;
};

export const home = {
	title: "steerkit: Craig Reynolds' steering behaviors for JavaScript",
	description:
		"Seek, arrive, wander, pursue: Craig Reynolds' steering behaviors as small, typed, engine-agnostic functions for JavaScript and Three.js. Interactive demos.",
};

export const pages: Page[] = [
	{
		id: "seek",
		title: "Seek",
		summary:
			"Full speed toward a target. The steering force (orange) is the velocity the agent wants (green: straight at the target, at maxSpeed) minus the velocity it has (blue): Reynolds' whole model in one subtraction. With nothing to slow it down, seek overshoots and circles back; that's what arrive is for.",
		description:
			"Interactive demo of seek, Craig Reynolds' steering behavior: full speed toward a target. Forces drawn, live parameters, and the steerkit code.",
		goal: "make a character head straight for a target (seek): a homing projectile, an enemy rushing the player",
	},
	{
		id: "flee",
		title: "Flee",
		summary:
			"Seek's opposite: full speed away from a point, however far it is. Here the agent wraps around the edges, or it would run away for good; keepAway is the version that only cares within a radius.",
		description:
			"Interactive demo of flee, Craig Reynolds' steering behavior: full speed away from a point. Forces drawn, live parameters, and the steerkit code.",
		goal: "make a character run away from a point or another character (flee)",
	},
	{
		id: "arrive",
		title: "Arrive",
		summary:
			"Seek that slows down: within slowingDistance of the target (the dashed circle), the desired speed drops in proportion to the distance left, down to a stop on the target itself. Set slowingDistance to 0 and it seeks again, overshoot included.",
		description:
			"Interactive demo of arrive, Craig Reynolds' steering behavior: seek that slows down to stop on its target. Forces drawn and the steerkit code.",
		goal: "make a character move to a target and stop on it smoothly instead of overshooting (arrive): click-to-move, a camera rig, a pet coming back",
	},
	{
		id: "keep-away",
		title: "Keep away",
		summary:
			"Flee, but only within a radius, and harder the closer the threat gets: the force fades to nothing at the edge, so entering the zone doesn't jolt. A personal space around a point. Each agent here blends it with arrive, back to its own spot.",
		description:
			"Interactive demo of keepAway in steerkit: flee within a radius, harder the closer, for a personal space around a point. Forces drawn, live code.",
		goal: "make characters keep a smooth personal space around a point or another character, e.g. the player or the camera (keepAway), blended with whatever moves them today",
	},
	{
		id: "pursue",
		title: "Pursue",
		summary:
			"Seek where the quarry will be, not where it is. The prediction looks ahead by the time the two would take to meet head-on, capped by maxPrediction: far away, the hunter aims well ahead; close up, right at the quarry. Switch to seek to see it trail behind instead.",
		description:
			"Interactive demo of pursuit, Craig Reynolds' steering behavior: intercept a moving quarry where it will be. Prediction drawn, steerkit code.",
		goal: "make a character intercept a moving target where it will be rather than chase where it is (pursue)",
	},
	{
		id: "evade",
		title: "Evade",
		summary:
			"Flee where the threat will be: an agent in the path of a moving threat dodges sideways, out of its way, rather than straight back. Here the pointer is the threat, and each agent blends evade with arrive back home. Like flee, evade pushes at full strength however far the threat is, so the crowd leans away from the pointer all the time; sweep it fast across the ring to see the dodge.",
		description:
			"Interactive demo of evasion, Craig Reynolds' steering behavior: flee where a moving threat will be, dodging out of its way. Live steerkit code.",
		goal: "make characters dodge a moving threat by fleeing where it will be (evade)",
	},
	{
		id: "wander",
		title: "Wander",
		summary:
			"A random walk that looks natural. The agent seeks a point on a circle ahead of it (dashed), and that point drifts a little at random every frame, so the heading changes in smooth curves instead of trembling. A larger radius turns sharper, a longer distance smoother, a higher jitter more often. In 3D, the circle is a sphere; here it's kept in the xy plane.",
		description:
			"Interactive demo of wander, Craig Reynolds' steering behavior: a natural random walk in smooth curves, in 2D or 3D. Live parameters and code.",
		goal: "make characters roam around naturally, in smooth random curves (wander): ambient creatures, idle NPCs, fireflies",
	},
	{
		id: "combine",
		title: "Combining",
		summary:
			"Fairies that wander around the center and keep away from the pointer: three behaviors, one force. blend sums them by weight, so a strong pull home can cancel a flight from danger. prioritize spends a budget (maxForce) in order: keepAway first takes what it needs, then arrive, then wander gets what's left, or nothing.",
		description:
			"Combine steering behaviors with steerkit: blend by weight or prioritize within a force budget. Fairies that wander and keep away, live code.",
		goal: "combine several steering behaviors on the same characters (blend or prioritize): e.g. wander around a spot while keeping away from the player",
	},
	{
		id: "speed-limit",
		title: "Speed limit",
		summary:
			"Every few seconds, a boost raises maxSpeed, then it drops back. Reynolds' limit (top lane, in blue on the chart) cuts the extra speed in a single frame: the agent stops dead. With overspeedDamping (bottom lane, in orange), the extra speed fades out over that many seconds instead, the same at any framerate.",
		description:
			"Soft speed limit in steerkit: when maxSpeed drops after a boost, fade the extra speed out instead of cutting it in one frame. Chart and code.",
		goal: "move characters with steerkit and make the end of a speed boost fade out smoothly (step with overspeedDamping)",
	},
];

export const page = (id: string): Page => {
	const found = pages.find((p) => p.id === id);
	if (!found) throw new Error(`No page ${id}`);
	return found;
};
