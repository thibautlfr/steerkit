# steerkit

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
