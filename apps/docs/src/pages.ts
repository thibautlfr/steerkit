// Every page of the site: its title, the text crawlers and link previews
// see, and the goal its "Copy prompt" hands to a coding agent. Plain data,
// read by the app and by the build (vite.config.ts) to prerender each page.

export const SITE = "https://steerkit.thibaut-lefrancois.com";

export type Page = {
	id: string;
	title: string;
	/** The family the demo is listed under in the navigation. */
	group: string;
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
		group: "Basics",
		summary:
			"Full speed toward a target. The steering force (orange) is the velocity the agent wants (green: straight at the target, at maxSpeed) minus the velocity it has (blue): Reynolds' whole model in one subtraction. With nothing to slow it down, seek overshoots and circles back; that's what arrive is for.",
		description:
			"Interactive demo of seek, Craig Reynolds' steering behavior: full speed toward a target. Forces drawn, live parameters, and the steerkit code.",
		goal: "make a character head straight for a target (seek): a homing projectile, an enemy rushing the player",
	},
	{
		id: "flee",
		title: "Flee",
		group: "Basics",
		summary:
			"Seek's opposite: full speed away from a point, however far it is. Here the agent wraps around the edges, or it would run away for good; keepAway is the version that only cares within a radius.",
		description:
			"Interactive demo of flee, Craig Reynolds' steering behavior: full speed away from a point. Forces drawn, live parameters, and the steerkit code.",
		goal: "make a character run away from a point or another character (flee)",
	},
	{
		id: "arrive",
		title: "Arrive",
		group: "Basics",
		summary:
			"Seek that slows down: within slowingDistance of the target (the dashed circle), the desired speed drops in proportion to the distance left, down to a stop on the target itself. Set slowingDistance to 0 and it seeks again, overshoot included.",
		description:
			"Interactive demo of arrive, Craig Reynolds' steering behavior: seek that slows down to stop on its target. Forces drawn and the steerkit code.",
		goal: "make a character move to a target and stop on it smoothly instead of overshooting (arrive): click-to-move, a camera rig, a pet coming back",
	},
	{
		id: "keep-away",
		title: "Keep away",
		group: "Basics",
		summary:
			"Flee, but only within a radius, and harder the closer the threat gets: the force fades to nothing at the edge, so entering the zone doesn't jolt. A personal space around a point. Each agent here blends it with arrive, back to its own spot.",
		description:
			"Interactive demo of keepAway in steerkit: flee within a radius, harder the closer, for a personal space around a point. Forces drawn, live code.",
		goal: "make characters keep a smooth personal space around a point or another character, e.g. the player or the camera (keepAway), blended with whatever moves them today",
	},
	{
		id: "wander",
		title: "Wander",
		group: "Basics",
		summary:
			"A random walk that looks natural. The agent seeks a point on a circle ahead of it (dashed), and that point drifts a little at random every frame, so the heading changes in smooth curves instead of trembling. A larger radius turns sharper, a longer distance smoother, a higher jitter more often. In 3D, the circle is a sphere; here it's kept in the xy plane.",
		description:
			"Interactive demo of wander, Craig Reynolds' steering behavior: a natural random walk in smooth curves, in 2D or 3D. Live parameters and code.",
		goal: "make characters roam around naturally, in smooth random curves (wander): ambient creatures, idle NPCs, fireflies",
	},
	{
		id: "pursue",
		title: "Pursue",
		group: "Prediction",
		summary:
			"Seek where the quarry will be, not where it is. The prediction looks ahead by the time the two would take to meet head-on, capped by maxPrediction: far away, the hunter aims well ahead; close up, right at the quarry. Switch to seek to see it trail behind instead.",
		description:
			"Interactive demo of pursuit, Craig Reynolds' steering behavior: intercept a moving quarry where it will be. Prediction drawn, steerkit code.",
		goal: "make a character intercept a moving target where it will be rather than chase where it is (pursue)",
	},
	{
		id: "evade",
		title: "Evade",
		group: "Prediction",
		summary:
			"Flee where the threat will be: an agent in the path of a moving threat dodges sideways, out of its way, rather than straight back. Here the pointer is the threat, and each agent blends evade with arrive back home. Like flee, evade pushes at full strength however far the threat is, so the crowd leans away from the pointer all the time; sweep it fast across the ring to see the dodge.",
		description:
			"Interactive demo of evasion, Craig Reynolds' steering behavior: flee where a moving threat will be, dodging out of its way. Live steerkit code.",
		goal: "make characters dodge a moving threat by fleeing where it will be (evade)",
	},
	{
		id: "separation",
		title: "Separation",
		group: "Groups",
		summary:
			"Each agent steers away from the neighbors it sees, harder from the nearest: every neighbor within the radius pushes along the line between them, weighted by 1/distance. The highlighted agent shows its neighborhood: the radius, and the field of view (neighbors behind it are ignored). Here it is blended with wander; set its weight to 0 to see the crowd without it.",
		description:
			"Interactive demo of separation, Reynolds' boids behavior: steer away from nearby neighbors to avoid crowding. Neighborhood drawn, steerkit code.",
		goal: "make characters keep their distance from each other in a crowd (separation), with the neighbors from the project's own list of characters",
	},
	{
		id: "cohesion",
		title: "Cohesion",
		group: "Groups",
		summary:
			"Each agent seeks the center of the neighbors it sees: what keeps a group together. On its own, cohesion clumps the agents into tight knots; flocking balances it with separation. Here it is blended with wander, so the groups keep moving.",
		description:
			"Interactive demo of cohesion, Reynolds' boids behavior: steer toward the center of nearby neighbors to stay together. Live steerkit code.",
		goal: "make characters stay together in groups (cohesion), with the neighbors from the project's own list of characters",
	},
	{
		id: "alignment",
		title: "Alignment",
		group: "Groups",
		summary:
			"Each agent steers toward the average velocity of the neighbors it sees: what makes a group head the same way. Starting in every direction, the agents line up into streams. Here it is blended with wander; a narrower field of view makes them follow those ahead rather than those around.",
		description:
			"Interactive demo of alignment, Reynolds' boids behavior: match the average heading of nearby neighbors. Field of view drawn, steerkit code.",
		goal: "make characters move in the same direction as their neighbors (alignment), with the neighbors from the project's own list of characters",
	},
	{
		id: "flocking",
		title: "Flocking",
		group: "Groups",
		summary:
			"Reynolds' boids: separation, alignment and cohesion together, and the pointer scares the flock. Finding the neighbors is the costly part: scanning the whole crowd costs n² distance checks, a spatial grid only looks at the nearby cells. Raise the count to 1,000 and switch between the two to see the time per frame.",
		description:
			"Boids in JavaScript with steerkit: separation, alignment and cohesion, and a spatial grid for 1,000 agents with no allocation. Live demo and code.",
		goal: "make a crowd of characters flock like birds or fish (separation, alignment and cohesion), with steerkit's spatial grid to find the neighbors if there are hundreds",
	},
	{
		id: "leader-following",
		title: "Leader following",
		group: "Leaders",
		summary:
			"The followers keep a spot behind the leader and match its velocity once there. One that finds itself in the leader's way (the shaded zone ahead of it) steps aside, out of its path. Separation keeps the followers from piling up on the same spot.",
		description:
			"Interactive demo of leader following, Reynolds' steering behavior: follow behind a leader and step out of its way. Live parameters and code.",
		goal: "make characters follow a leader, e.g. the player, staying behind it and out of its way (follow, with separation among the followers)",
	},
	{
		id: "offset-pursuit",
		title: "Offset pursuit",
		group: "Leaders",
		summary:
			"Each wingman keeps a slot in the leader's frame, ahead or behind along its heading and to its side: a formation. Once in its slot, it matches the leader's velocity; within slowingDistance of it, it eases in. The slots turn with the leader, so the V follows every turn.",
		description:
			"Interactive demo of offset pursuit, Reynolds' steering behavior: keep a slot relative to a leader, for formations. Live parameters and code.",
		goal: "make characters move in formation around a leader, each keeping its own slot relative to the leader's heading (offsetPursuit)",
	},
	{
		id: "obstacle-avoidance",
		title: "Obstacle avoidance",
		group: "Environment",
		summary:
			"The agents go to the pointer through a field of rocks. Each one looks lookAhead seconds ahead, in a corridor as wide as itself (shaded for the highlighted agent): of the rocks it would hit, the nearest makes it turn toward the direction that just clears it, the wider the nearer. Avoidance comes first and weighs 3: with the pointer behind a rock, a weaker one would be cancelled by the pull toward it. Lower its weight to see the agents run into the rocks.",
		description:
			"Interactive demo of obstacle avoidance, Craig Reynolds' steering behavior: steer around the rocks in the way. Detection corridor drawn, steerkit code.",
		goal: "make characters steer around obstacles in their way (avoidObstacles), with the obstacles as circles or spheres from the project's own scene",
	},
	{
		id: "collision-avoidance",
		title: "Collision avoidance",
		group: "Environment",
		summary:
			"Two streams of agents cross, and the pointer walks through them. Each agent predicts when it would pass closest to every other, and dodges the soonest one it would bump into: two agents head-on both turn right, and pass. Turn it off to see them run into each other: the counter shows how often two come within reach.",
		description:
			"Interactive demo of unaligned collision avoidance, Reynolds' steering behavior: predict and dodge the other movers. Live parameters and code.",
		goal: "make moving characters dodge each other before they collide, e.g. pedestrians crossing (avoidCollisions), with the spatial grid if there are hundreds",
	},
	{
		id: "containment",
		title: "Containment",
		group: "Environment",
		summary:
			"The agents wander in a box. When one would cross the margin (dashed) within lookAhead seconds, it turns back toward the inside at full speed, keeping its velocity along the wall: it slides off the walls rather than bouncing. Inside the margin, the force is zero, and wander has the agent to itself.",
		description:
			"Interactive demo of containment, Craig Reynolds' steering behavior: keep agents inside a box, turning back before the walls. Live steerkit code.",
		goal: "keep characters inside an area, e.g. a room, an arena or the screen, turning back smoothly before the edges (stayWithin)",
	},
	{
		id: "path-following",
		title: "Path following",
		group: "Environment",
		summary:
			"The agents follow a loop, like cars on a road: the path has a radius (the shaded band). Each one checks where it will be in lookAhead seconds: still on the road and heading along it, it goes its own way; off it, it steers back to a point further along. Separation keeps them from queuing in single file.",
		description:
			"Interactive demo of path following, Craig Reynolds' steering behavior: stay within a radius of a path, open or closed. Live parameters and code.",
		goal: "make characters follow a route, e.g. a patrol, a race track or a guide along a trail, from a list of points (followPath)",
	},
	{
		id: "flow-field",
		title: "Flow field",
		group: "Environment",
		summary:
			"A grid of directions, slowly changing, and the pointer stirs a vortex into it. Each agent reads the flow where it will be in lookAhead seconds, and heads that way at full speed: a current, a wind, crowds following a map. The field is any function: here a grid, looked up in a few lines.",
		description:
			"Interactive demo of flow field following, Reynolds' steering behavior: go with a current read from a grid of directions. Live steerkit code.",
		goal: "make characters follow a flow field, e.g. a current, a wind or a map of directions to a goal (followFlow), with the field from the project's own data",
	},
	{
		id: "combine",
		title: "Combining",
		group: "Combining",
		summary:
			"Fairies that wander around the center and keep away from the pointer: three behaviors, one force. blend sums them by weight, so a strong pull home can cancel a flight from danger. prioritize spends a budget (maxForce) in order: keepAway first takes what it needs, then arrive, then wander gets what's left, or nothing.",
		description:
			"Combine steering behaviors with steerkit: blend by weight or prioritize within a force budget. Fairies that wander and keep away, live code.",
		goal: "combine several steering behaviors on the same characters (blend or prioritize): e.g. wander around a spot while keeping away from the player",
	},
	{
		id: "speed-limit",
		title: "Speed limit",
		group: "Combining",
		summary:
			"Every few seconds, a boost raises maxSpeed, then it drops back. Reynolds' limit (top lane, in blue on the chart) cuts the extra speed in a single frame: the agent stops dead. With overspeedDamping (bottom lane, in orange), the extra speed fades out over that many seconds instead, the same at any framerate.",
		description:
			"Soft speed limit in steerkit: when maxSpeed drops after a boost, fade the extra speed out instead of cutting it in one frame. Chart and code.",
		goal: "move characters with steerkit and make the end of a speed boost fade out smoothly (step with overspeedDamping)",
	},
];

/** The pages by group, in the order they first appear. */
export const groups = (): { name: string; pages: Page[] }[] => {
	const out: { name: string; pages: Page[] }[] = [];
	for (const p of pages) {
		const last = out[out.length - 1];
		if (last?.name === p.group) last.pages.push(p);
		else out.push({ name: p.group, pages: [p] });
	}
	return out;
};

/** The pages before and after `id`, wrapping around the ends. */
export const neighbors = (id: string): { previous: Page; next: Page } => {
	const i = Math.max(
		0,
		pages.findIndex((p) => p.id === id),
	);
	const n = pages.length;
	return {
		previous: pages[(i + n - 1) % n] as Page,
		next: pages[(i + 1) % n] as Page,
	};
};

export const page = (id: string): Page => {
	const found = pages.find((p) => p.id === id);
	if (!found) throw new Error(`No page ${id}`);
	return found;
};
