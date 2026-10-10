# steerkit

## 0.4.0

### Minor Changes

- 1d974cb: `separation` and `cohesion` no longer push at full strength whatever the distances. `separation` fades out as `keepAway` does, as the nearest neighbor nears the edge of `radius`, so a neighbor coming into sight doesn't jolt. `cohesion` is a pull toward the center of the neighbors, harder the farther it is (`maxSpeed` at `radius`), instead of a seek: agents no longer overshoot the center and circle it forever, and a tight school no longer trembles. Cohesion is weaker in the middle of a group: a weight about twice as high gives the old grouping.
- 55ea66e: Add `steerkit/three`, an optional Three.js adapter (`three` as an optional peer dependency), starting with `faceVelocity`: turns an object to face its velocity as `lookAt` does, +z forward and upright along `object.up`, smoothed by a turn rate the same at any framerate.
- 55ea66e: Add `SteeringHelper` to `steerkit/three`: draws the forces for debugging in one draw call, Reynolds' diagram of an agent (velocity, desired velocity, steering force) as in the demos, and circles, spheres, boxes and paths for zones, obstacles, walls and roads.
- 55ea66e: Add `setInstances` to `steerkit/three`: draws a crowd in one call, writing each agent's position and an orientation facing its velocity into the matrices of an `InstancedMesh`, without allocating.

## 0.3.0

### Minor Changes

- fb70c91: Add Reynolds' avoidance behaviors: `avoidObstacles`, to steer around spheres (circles in 2D) in the agent's way, and `avoidCollisions`, his unaligned collision avoidance, to steer clear of other movers. Both look `lookAhead` seconds ahead and dodge the soonest threat sideways, harder the sooner.
- 5648ff8: Add flow field following: `followFlow` heads the way a field points where the agent will be. The field is any function writing a direction into a vector: a grid, a noise, a formula.
- 6cdd002: Add path following: `followPath` takes a polyline, open or closed, and keeps the agent within a radius of it, steering back to a point further along when it strays. An open path ends in an arrival on its last point.
- 478786b: Add containment: `stayWithin` keeps an agent inside a box (`THREE.Box3` fits as is), turning it back when it would cross a margin from the walls within `lookAhead` seconds.

### Patch Changes

- 3661131: `keepAway` no longer allocates when V8 stops inlining in a large frame: it computes its force in locals instead of calling `flee`. A crowd of 1,000 agents combining `wander`, `arrive` and `keepAway` with `zero` and `add` drops from about 5 KiB to about 1 KiB of garbage per frame. `arrive` no longer mixes `Infinity` into its computation either.

## 0.2.0

### Minor Changes

- a681b46: Add Reynolds' group behaviors: `separation`, `cohesion` and `alignment`, with a neighborhood of a radius and an optional field of view. They take any array-like list of movers, the agent itself included.
- d12ee22: Add Reynolds' leader behaviors: `offsetPursuit`, to keep a slot in a formation, and `follow`, to follow behind a leader and step out of its way. Both match the leader's velocity once in place.
- f1c0211: Add a spatial grid to find neighbors in large crowds without allocating: `createGrid`, `updateGrid` once per frame, and `queryGrid` into a list from `createNeighbors`.

## 0.1.0

### Minor Changes

- 7adc2c9: First release: seek, flee, arrive, keepAway, brake, pursue, evade and wander;
  blend and prioritize, with their allocation-free forms zero, add and
  addWithin; step, with an optional soft speed limit.
