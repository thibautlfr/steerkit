---
"steerkit": minor
---

Add Reynolds' avoidance behaviors: `avoidObstacles`, to steer around spheres (circles in 2D) in the agent's way, and `avoidCollisions`, his unaligned collision avoidance, to steer clear of other movers. Both look `lookAhead` seconds ahead and dodge the soonest threat sideways, harder the sooner.
