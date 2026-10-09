# steerkit

Craig Reynolds' [steering behaviors](https://www.red3d.com/cwr/steer/gdc99/)
for autonomous characters, as small, typed functions that work on your own
objects. `seek`, `arrive`, `wander` and `keepAway` by name, instead of
anonymous vector maths rewritten in every project.

- **Engine-agnostic.** Any `{ x, y, z }` is a vector: plain objects,
  `THREE.Vector3` as it is, your engine's own. No dependency.
- **No allocation per frame.** Every behavior writes into a vector you pass
  and returns it.
- **Small.** 2.8 kB for everything (minified and brotlied), tree-shakable:
  `seek` alone is 170 B.
- **Reynolds' model, canonical.** `maxSpeed`, `maxForce`, optional `mass`,
  and `dt` everywhere, in units per second.

**[Interactive demos](https://steerkit.thibaut-lefrancois.com)**: one per
behavior, with the forces drawn and sliders for every parameter.

**Working with a coding agent?** Each demo has a "Copy prompt" button that
asks your agent to bring that behavior into your project, and the agent-ready
documentation lives at
[steerkit.thibaut-lefrancois.com/llms.txt](https://steerkit.thibaut-lefrancois.com/llms.txt).

## Install

```sh
npm install steerkit
```

ESM only, with TypeScript types.

## Example

A fairy flies to its target but keeps out of the camera's way:

```ts
import { arrive, blend, keepAway, step } from "steerkit";

const vec = (x = 0, y = 0, z = 0) => ({ x, y, z }); // or THREE.Vector3, as is
const fairy = { position: vec(), velocity: vec(), maxSpeed: 2, maxForce: 4 };
const [force, goal, away] = [vec(), vec(), vec()]; // reused every frame

// Every frame
blend(force,
	[arrive(fairy, target, { slowingDistance: 1.2 }, goal), 1],
	[keepAway(fairy, camera, { radius: 1 }, away), 2],
);
step(fairy, force, dt);
```

With Three.js, `position` can be the mesh's own `mesh.position`: `step`
moves it directly.

## How it works

Reynolds splits a character's motion into three layers: **action
selection** (where to go: your game logic), **steering** (how to get there:
this library), and **locomotion** (how it looks: your animation).

The steered character is a point mass, an `Agent`:

```ts
type Agent = {
	position: Vec3;
	velocity: Vec3;
	maxSpeed: number; // units per second
	maxForce: number; // units per second², low turns like a ship, high like a fly
	mass?: number; // 1 when not given
};
```

Each behavior turns a goal into a **steering force**: the velocity the agent
would like to have, minus the velocity it has. Forces are then **combined**,
and `step` applies the result for `dt` seconds: the force is bounded by
`maxForce`, the speed by `maxSpeed`.

## API

All behaviors take the agent first and write into `out` last, which they
return. `out` may be any of the inputs.

| Function | What it does |
| --- | --- |
| `seek(agent, target, out)` | Full speed toward `target`. |
| `flee(agent, from, out)` | Full speed away from `from`. |
| `arrive(agent, target, { slowingDistance }, out)` | Seek that slows down within `slowingDistance`, to stop on `target`. |
| `keepAway(agent, from, { radius }, out)` | Flee only within `radius`, harder the closer: a personal space around a point. |
| `brake(agent, out)` | Come to a stop. |
| `pursue(agent, quarry, { maxPrediction? }, out)` | Seek where a moving `quarry` will be. |
| `evade(agent, threat, { maxPrediction? }, out)` | Flee where a moving `threat` will be. |
| `wander(agent, state, { radius, distance, jitter, plane? }, dt, out)` | A natural random walk; `state` comes from `createWanderState(random?)`, one per agent. |
| `separation(agent, neighbors, { radius, fieldOfView? }, out)` | Steer away from the neighbors, harder from the nearest. |
| `cohesion(agent, neighbors, { radius, fieldOfView? }, out)` | Steer toward the center of the neighbors. |
| `alignment(agent, neighbors, { radius, fieldOfView? }, out)` | Steer toward the average velocity of the neighbors. |
| `follow(agent, leader, { distance, slowingDistance, plane? }, out)` | Follow behind a leader, and step out of its way. |
| `offsetPursuit(agent, leader, { ahead, side, slowingDistance, plane? }, out)` | Keep a slot relative to a leader: formations. |
| `blend(out, ...[force, weight])` | The weighted sum of forces. |
| `prioritize(out, budget, ...forces)` | Forces in order of priority, within a budget (typically `maxForce`). |
| `zero(out)`, `add(out, force, weight?)` | The allocation-free form of `blend`. |
| `addWithin(out, budget, force, weight?)` | The allocation-free form of `prioritize`. |
| `step(agent, force, dt, { overspeedDamping? }?)` | Moves the agent under `force` for `dt` seconds. |
| `createGrid({ cellSize, plane? })`, `updateGrid(grid, agents)` | A spatial grid, sorted once per frame, to find neighbors fast. |
| `queryGrid(grid, position, radius, out)` | The agents within `radius`, into a list from `createNeighbors()`. |

`pursue`, `evade`, `follow` and `offsetPursuit` take any `{ position,
velocity }`, another agent included.

### Combining forces

`blend` sums forces by weight: simple, but opposed forces can cancel out (an
agent stuck between its target and a threat). `prioritize` spends a budget
in order: the first force takes what it needs, the next ones share what's
left.

```ts
prioritize(force, fairy.maxForce,
	keepAway(fairy, camera, { radius: 1 }, away), // first, always
	arrive(fairy, target, { slowingDistance: 1.2 }, goal),
	wander(fairy, state, { radius: 1, distance: 2, jitter: 3 }, dt, roam), // what's left
);
```

**Readable or allocation-free.** `blend` and `prioritize` read best, but
their arguments (the tuples, the list of forces) are small arrays created on
every call. Harmless for a few agents; for hundreds, write the same sum
with `zero` and `add` (or `addWithin`):

```ts
zero(force);
add(force, arrive(fairy, target, { slowingDistance: 1.2 }, tmp), 1);
add(force, keepAway(fairy, camera, { radius: 1 }, tmp), 2); // one tmp is enough
```

For 1,000 agents (wander, arrive and keepAway each, Node 26 on an M1 Pro),
both take about 0.1 ms per frame, but `blend` leaves about 190 KiB of
garbage per frame, 11 MB per second at 60 fps, while `zero` and `add` leave
about 1 KiB: a few numbers V8 boxes where it stops inlining a frame this
large. In the same hot loops, hoist options objects (`{ slowingDistance }`)
out of the loop as constants.

### Flocking

`separation`, `cohesion` and `alignment` are Reynolds' boids: each agent
reacts to the neighbors it sees, within `radius` and, optionally, a
`fieldOfView` (in radians, centered on its velocity: neighbors behind it
are ignored). `neighbors` is any list of `{ position, velocity }`: the
whole crowd works, the agent itself included, which they ignore.

Scanning the whole crowd costs n² distance checks per frame. Beyond a few
dozen agents, a spatial grid finds the neighbors in the nearby cells only,
without allocating:

```ts
import { add, alignment, cohesion, createGrid, createNeighbors, queryGrid, separation, step, updateGrid, zero } from "steerkit";

const grid = createGrid({ cellSize: 2 }); // about the largest radius you query
const near = createNeighbors(); // the list queryGrid writes into, reused
const close = { radius: 1 };
const around = { radius: 2 };

// Every frame
updateGrid(grid, boids);
for (const boid of boids) {
	const neighbors = queryGrid(grid, boid.position, around.radius, near);
	zero(force);
	add(force, separation(boid, neighbors, close, tmp), 1.5);
	add(force, alignment(boid, neighbors, around, tmp), 1);
	add(force, cohesion(boid, neighbors, around, tmp), 1);
	step(boid, force, dt);
}
```

For 1,000 boids (Node 26 on an M1 Pro), a frame takes about 12 ms when
each one scans the whole crowd, 0.7 ms with the grid, and neither leaves
garbage.

### Following a leader

`follow` keeps an agent `distance` behind a leader, and steps aside when
it finds itself in the leader's way. `offsetPursuit` keeps a slot in the
leader's frame, `ahead` along its heading and `side` across it: a place in
a formation. Both match the leader's velocity once in place.

```ts
// A V of wingmen, one slot each, created once
const slots = [1, 2, 3].flatMap((k) =>
	[-1, 1].map((s) => ({ ahead: -k, side: s * k, slowingDistance: 1, plane: "xz" as const })),
);

// Every frame, wingman i keeps slots[i]
offsetPursuit(wingman, leader, slots[i], force);
```

The leader's heading is its velocity. `side` is positive to its right,
`forward × up`, up being the normal of `plane` (+y for `"xz"` and without
a plane, +z for `"xy"`). Add `separation` among followers so they don't
pile up on the same spot.

### 2D

Keep `z` at 0, and pass `plane: "xy"` to the functions that take one:
every behavior then keeps `z` at 0. `wander`, `follow`, `offsetPursuit`
and `createGrid` take a `plane` (`"xy"` for a 2D canvas, `"xz"` for
characters on the ground). Without it, `wander` roams on a sphere, in all
three axes, and the leader behaviors take +y as up.

### Speed limit

Reynolds' model cuts the speed to `maxSpeed` at once. When `maxSpeed` drops
(the end of a speed boost), the agent loses all its extra momentum in a
single frame. `overspeedDamping` makes the extra speed fade out over that
many seconds instead, the same at any framerate:

```ts
step(fairy, force, dt, { overspeedDamping: 0.5 });
```

The force can still turn the agent meanwhile, just not speed it up past the
fading limit.

### Good to know

- **Orientation is yours.** steerkit moves a point; turn your model to face
  its velocity, e.g. in Three.js `mesh.lookAt(tmp.copy(position).add(velocity))`.
- **Clamp `dt`.** A frame after a tab was in the background can last
  seconds: bound it before calling `step` (`Math.min(dt, 1 / 20)`).
- **Randomness.** `createWanderState(random)` takes any generator in
  `[0, 1)`; a seeded one gives reproducible wandering. `Math.random`
  (the default) allocates a little in V8: use your own generator if every
  byte counts.

## Compared to

[Yuka](https://github.com/Mugen87/yuka) is the closest library: a complete
game AI framework (state machines, navigation, perception) with more steering
behaviors (14), built around its own `Vector3`, `Vehicle` and `EntityManager`.
If you want that framework, use it. steerkit does one thing, steering, on
the objects you already have, and stays out of the rest.

## Roadmap

- **0.3**: the environment: obstacle avoidance, containment, path
  following, flow fields, unaligned collision avoidance.
- **0.4**: a `steerkit/three` adapter with debug helpers to draw the forces.

## References

- Craig Reynolds, [*Steering Behaviors For Autonomous Characters*](https://www.red3d.com/cwr/steer/gdc99/), GDC 1999
- Craig Reynolds, [*Flocks, Herds, and Schools*](https://www.red3d.com/cwr/boids/), SIGGRAPH 1987
- Daniel Shiffman, [*The Nature of Code*, chapter 5](https://natureofcode.com/autonomous-agents/)
- Mat Buckland, *Programming Game AI by Example*: `prioritize` is
  his "truncated running sum with prioritization"
- Matthias Müller, [*Ten Minute Physics*, "Spatial hashing"](https://matthias-research.github.io/pages/tenMinutePhysics/): the dense hash behind the grid

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
