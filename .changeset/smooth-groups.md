---
"steerkit": minor
---

`separation` and `cohesion` no longer push at full strength whatever the distances. `separation` fades out as `keepAway` does, as the nearest neighbor nears the edge of `radius`, so a neighbor coming into sight doesn't jolt. `cohesion` is a pull toward the center of the neighbors, harder the farther it is (`maxSpeed` at `radius`), instead of a seek: agents no longer overshoot the center and circle it forever, and a tight school no longer trembles. Cohesion is weaker in the middle of a group: a weight about twice as high gives the old grouping.
