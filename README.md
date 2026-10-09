# steerkit

Craig Reynolds' [steering behaviors](https://www.red3d.com/cwr/steer/gdc99/)
for autonomous characters, as small, typed functions that work on your own
objects. `seek`, `arrive`, `wander` and `keepAway` by name, instead of
anonymous vector maths rewritten in every project.

- **Engine-agnostic.** Any `{ x, y, z }` is a vector: plain objects,
  `THREE.Vector3` as it is, your engine's own. No dependency; an optional
  `steerkit/three` adapter turns, instances and debugs Three.js models.
- **No allocation per frame.** Every behavior writes into a vector you pass
  and returns it.
- **Small.** 4.1 kB for everything (minified and brotlied), tree-shakable:
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
moves it directly, and [`steerkit/three`](#threejs) turns it to face its
way.

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
| `cohesion(agent, neighbors, { radius, fieldOfView? }, out)` | Steer toward the center of the neighbors, harder the farther it is. |
| `alignment(agent, neighbors, { radius, fieldOfView? }, out)` | Steer toward the average velocity of the neighbors. |
| `follow(agent, leader, { distance, slowingDistance, plane? }, out)` | Follow behind a leader, and step out of its way. |
| `offsetPursuit(agent, leader, { ahead, side, slowingDistance, plane? }, out)` | Keep a slot relative to a leader: formations. |
| `avoidObstacles(agent, obstacles, { radius, lookAhead, plane? }, out)` | Steer around the spheres (circles in 2D) in the way. |
| `avoidCollisions(agent, others, { radius, lookAhead, plane? }, out)` | Dodge the other movers before bumping into them. |
| `stayWithin(agent, { min, max }, { margin, lookAhead }, out)` | Turn back before the walls of a box. |
| `followPath(agent, points, { radius, lookAhead, closed? }, out)` | Follow a polyline, within `radius` of it. |
| `followFlow(agent, field, { lookAhead }, out)` | Go the way a flow field points. |
| `blend(out, ...[force, weight])` | The weighted sum of forces. |
| `prioritize(out, budget, ...forces)` | Forces in order of priority, within a budget (typically `maxForce`). |
| `zero(out)`, `add(out, force, weight?)` | The allocation-free form of `blend`. |
| `addWithin(out, budget, force, weight?)` | The allocation-free form of `prioritize`. |
| `step(agent, force, dt, { overspeedDamping? }?)` | Moves the agent under `force` for `dt` seconds. |
| `createGrid({ cellSize, plane? })`, `updateGrid(grid, agents)` | A spatial grid, sorted once per frame, to find neighbors fast. |
| `queryGrid(grid, position, radius, out)` | The agents within `radius`, into a list from `createNeighbors()`. |
| `faceVelocity(object, velocity, dt, { turnRate?, minSpeed? }?)` | From `steerkit/three`: turns a Three.js object toward its velocity, smoothly. |
| `setInstances(mesh, agents, { up?, minSpeed? }?)` | From `steerkit/three`: a crowd's positions and headings into an `InstancedMesh`. |
| `new SteeringHelper({ capacity?, seconds?, headLength?, colors? }?)` | From `steerkit/three`: draws the forces and shapes, for debugging. |

`pursue`, `evade`, `follow`, `offsetPursuit` and `avoidCollisions` take
any `{ position, velocity }`, another agent included. `lookAhead` is in
seconds, like `dt`.

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

Separation fades out as keepAway does, as the nearest neighbor nears the
edge of `radius`, and cohesion pulls harder the farther the center is,
`maxSpeed` at `radius`: neither jolts when a neighbor comes into sight, nor
sends an agent circling the center of its group.

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

### The environment

`avoidObstacles` steers around obstacles, any `{ position, radius }`:
spheres, or circles in 2D. The agent watches a corridor as wide as its own
`radius`, as far as it travels in `lookAhead` seconds; the nearest obstacle
in it makes the agent turn, at the same speed, toward the direction that
just clears it. `avoidCollisions` dodges other movers (Reynolds' unaligned
collision avoidance): it predicts when each one would pass closest, and
steps aside from the soonest it would bump into. Two agents heading for
each other both turn right, and pass.

Both return a zero force when the way is clear. Put them first, and give
them weight: with a target behind a rock, an equal pull toward it would
cancel the avoidance out.

```ts
zero(force);
addWithin(force, fairy.maxForce, avoidObstacles(fairy, rocks, { radius: 0.3, lookAhead: 1 }, tmp), 3);
addWithin(force, fairy.maxForce, arrive(fairy, target, { slowingDistance: 1.2 }, tmp));
step(fairy, force, dt);
```

Obstacles have a `position`, so the spatial grid sorts hundreds of them as
it sorts a crowd. For `avoidCollisions` in a crowd, query the grid as far
as two agents close in on each other in `lookAhead` seconds:
`2 × maxSpeed × lookAhead + 2 × radius`. For 1,000 agents (Node 26 on an
M1 Pro), a frame takes about 15 ms scanning the whole crowd, 0.7 ms with
the grid, and neither leaves garbage.

`stayWithin` keeps the agent inside a box, any `{ min, max }`
(`THREE.Box3` as is; in 2D, give it no depth): when it would cross
`margin` from a wall within `lookAhead` seconds, it turns back, keeping its
velocity along the wall. `followPath` follows a list of points, a plain
array or a curve's samples, `closed` for a loop: within `radius` of the
path the agent goes its own way, beyond it steers back to a point further
along, and an open path ends in an arrival on its last point.

`followFlow` heads the way a field points where the agent will be. The
field is yours, a function writing a direction into `out`: a grid, a
noise, a formula.

```ts
// A grid of directions, x and y in turn, filled by your own logic
const flow = new Float32Array(cols * rows * 2);
const field = (p, out) => {
	const i = Math.min(cols - 1, Math.max(0, Math.floor(p.x / size)));
	const j = Math.min(rows - 1, Math.max(0, Math.floor(p.y / size)));
	out.x = flow[(j * cols + i) * 2];
	out.y = flow[(j * cols + i) * 2 + 1];
	out.z = 0;
	return out;
};

followFlow(agent, field, { lookAhead: 0.3 }, force);
```

The field may be handed the same vector as `p` and `out`: read `p` before
writing `out`, as the field above does.

### 2D

Keep `z` at 0, and pass `plane: "xy"` to the functions that take one:
every behavior then keeps `z` at 0. `wander`, `follow`, `offsetPursuit`,
`avoidObstacles`, `avoidCollisions` and `createGrid` take a `plane`
(`"xy"` for a 2D canvas, `"xz"` for characters on the ground). Without it,
`wander` roams on a sphere, in all three axes, and the leader and
avoidance behaviors take +y as up.

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

### Three.js

The vectors already fit, and an agent can lend its mesh's `position`. The
optional `steerkit/three` adapter does the rest. It needs `three` (0.152 or
later) installed, and adds 2.6 kB, three not counted:

- `faceVelocity` turns an object toward its velocity, upright along
  `object.up`, as smoothly at any framerate.
- `setInstances` writes a crowd's positions and headings into an
  `InstancedMesh`: hundreds of agents, one draw call.
- `SteeringHelper` draws the forces as the demos do, and spheres, circles,
  boxes and paths for obstacles, zones, bounds and roads, in one draw call.

```ts
import * as THREE from "three";
import { faceVelocity, SteeringHelper, setInstances } from "steerkit/three";

// A school of fish, facing +z, in one draw call
const fish = new THREE.InstancedMesh(geometry, material, school.length);
fish.frustumCulled = false; // three doesn't follow moving instances
const helper = new SteeringHelper(); // the forces, for debugging
scene.add(fish, sharkMesh, helper);

// Every frame, once the agents have moved
setInstances(fish, school);
faceVelocity(sharkMesh, shark.velocity, dt, { turnRate: 4 });
helper.reset();
helper.vectors(school[0], forces[0]);
helper.sphere(rock.position, rock.radius);
```

Models face +z, as with `lookAt`: rotate the geometry once if yours faces
elsewhere. Instances live in the mesh's space, so keep the mesh at the
origin; at a stop, an instance keeps its heading. The helper holds 4,096
line segments (19 for an agent's vectors) unless given a `capacity`, and
leaves out what doesn't fit; its lines are a pixel wide, and
`helper.material.depthTest = false` draws them over the meshes. None of the
three allocates per frame. The
[aquarium](https://steerkit.thibaut-lefrancois.com/aquarium/) puts them
together.

### Good to know

- **Orientation is yours**, outside Three.js: steerkit moves a point; turn
  your model to face its velocity. In Three.js, `faceVelocity` and
  `setInstances` do it.
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

Nothing planned past 0.4 yet: open an issue for the behavior or the
adapter your project needs.

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
