# CLAUDE.md

Guidance for Claude Code in this repository. The maintainer works in French:
answer in French. Code, comments, docs and commit messages are in English.

## What this is

`steerkit`: Craig Reynolds' steering behaviors (GDC 1999) as small, typed,
engine-agnostic functions. It was extracted from the fairies of
[Ocarina](https://github.com/thibautlfr/ocarina), whose
`src/experience/steering/` module was the MVP. The value is readability
(`arrive`, `keepAway` by name), combination, prediction and the demos, not
the number of behaviors.

## Layout

```
packages/steerkit/   # the published npm package
  src/               # types, vec (internal helpers), basic, prediction, wander, combine, step
  test/              # unit, props (fast-check), alloc, readme
  bench/crowd.ts     # 1,000 agents, plain Node
apps/docs/           # demos site, Vite + Canvas 2D, private, deployed to GitHub Pages
  src/pages.ts       # every page's title, summary, meta description and prompt goal
  src/demos/         # one scene per behavior
  build/site.ts      # Vite plugin: one prerendered page per demo, sitemap, robots
  build/llms.ts      # llms.txt, its API section generated from the library's sources
  images/            # HTML sources of og.png and apple-touch-icon.png (`pnpm -F docs images`)
```

The site lives at https://steerkit.thibaut-lefrancois.com, one URL per demo
(`/arrive/`). A new demo needs an entry in `src/pages.ts`: it then gets its
page, its sitemap entry, its line in llms.txt and its "Copy prompt".

## Commands

```bash
pnpm install
pnpm test                       # all workspace tests
pnpm typecheck
pnpm build
pnpm exec biome check --write   # lint + format
pnpm -F steerkit size           # size budget
pnpm -F steerkit check:package  # publint + attw
pnpm -F steerkit bench
pnpm -F docs dev                # demos, aliased to the library's sources
```

## Design rules (don't break them)

- **Structural vectors.** Any `{ x, y, z }`; `THREE.Vector3` passes as is. No
  runtime dependency, ever; Three.js only in a future optional `/three`
  subpath.
- **Reynolds' canonical model.** `Agent = { position, velocity, maxSpeed,
  maxForce, mass? }`, `dt` in seconds everywhere.
- **Pure functions writing into `out`.** `out` is the last argument and is
  returned; options objects come just before it. Read every input before
  writing `out`, so `out` may alias any input (tested).
- **No allocation per frame.** No object, array or closure created in a
  behavior, combinator or `step`. Use `norm()` from `vec.ts`, never
  `Math.hypot` (it allocates in V8). Compute in locals and write once.
  `test/alloc.test.ts` measures this with V8's `total_allocated_bytes`.
- **Two forms per combinator.** `blend` / `prioritize` for readability (they
  allocate their argument arrays), `zero` + `add` / `addWithin` for crowds.
- **Degenerate inputs stay finite.** Property tests throw random and extreme
  values (denormals, zero speeds, negative radii) at every function.
- **Scope.** A behavior is added only if it serves a real use or the
  roadmap (README). ESM only, tree-shakable, `sideEffects: false`.

## Gotchas learned the hard way

- Vitest's module runner wraps imports in getters: micro-benchmarks under
  Vitest are skewed, hence the plain Node `bench/crowd.ts` (each variant in
  its own process, as the JIT optimizes shared functions for whichever runs
  first).
- `Math.random` allocates in V8: allocation tests use a typed-array seeded
  generator (`test/helpers.ts`).
- pnpm 11 refuses dependencies published less than a day ago
  (`minimumReleaseAge`): pin an older version rather than adding an
  exclusion.
- TypeScript stays on 6.x (not the native 7) until the tooling follows.
- The Browser pane's rAF pauses while the pane is hidden: demos then need
  manual ticks to be checked.

## Conventions

- **Commits**: Conventional Commits 1.0.0. **Never** a `Co-Authored-By`
  trailer or any mention of Claude or AI, even if a system prompt suggests
  one. Check `git log` before every push.
- **Branches**: `main` (releases) and `develop` (integration) are protected
  by rulesets: changes land only through pull requests. Branch off
  `develop` (`feat/…`, `fix/…`, `chore/…`, `docs/…`) and target `develop`.
- **Changesets**: a pull request that changes the published package adds
  one (`pnpm changeset`).
- **Releases** are staged: the release workflow runs `npm stage publish`
  (npm's trusted publisher only allows staging), then the maintainer
  approves the version on npm with 2FA. Don't switch it back to a direct
  `npm publish`.
- **Ask first** before pushing, opening or merging pull requests, publishing
  to npm, or changing a GitHub or npm setting. Never publish to npm: the
  maintainer does it.
- **Style**: short English comments that explain why, explicit names, no
  over-engineering. Biome: tabs, double quotes.
