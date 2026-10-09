---
"steerkit": patch
---

`keepAway` no longer allocates when V8 stops inlining in a large frame: it computes its force in locals instead of calling `flee`. A crowd of 1,000 agents combining `wander`, `arrive` and `keepAway` with `zero` and `add` drops from about 5 KiB to about 1 KiB of garbage per frame. `arrive` no longer mixes `Infinity` into its computation either.
