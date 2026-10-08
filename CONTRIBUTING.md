# Contributing

Thanks for helping! steerkit stays small on purpose: a behavior is added
when it serves a real use or the [roadmap](README.md#roadmap), not to grow
the catalog.

## Setup

Node ≥ 22 and [pnpm](https://pnpm.io) 11 (pinned in the `packageManager`
field of `package.json`).

```sh
pnpm install
pnpm -F docs dev     # the demos, served from the library's sources
```

## Layout

```
packages/steerkit/   # the published library
  src/               # one file per family: basic, prediction, wander, combine, step
  test/              # unit, property, allocation and README tests
  bench/             # the 1,000-agent baseline
apps/docs/           # the demos site (Vite + Canvas 2D), not published
```

## Checks

The CI runs all of these on every pull request:

```sh
pnpm exec biome ci          # lint and format (tabs, double quotes)
pnpm typecheck
pnpm test
pnpm build
pnpm -F steerkit size       # the size budget (size-limit)
pnpm -F steerkit check:package   # exports and types (publint, attw)
```

`pnpm exec biome check --write` fixes the formatting.

### Tests

- **Unit tests** check each formula against values worked out by hand.
- **Property tests** ([fast-check](https://fast-check.dev)) throw random
  inputs at every function: outputs stay finite, the speed never exceeds
  `maxSpeed`, the force never exceeds `maxForce`.
- **Allocation tests** count the bytes V8 allocates over thousands of calls,
  so a per-frame function never creates an object. Two things they taught
  us: `Math.hypot` allocates in V8 (the library uses `Math.sqrt`), and so
  does `Math.random`. They run on Node ≥ 22.18 and skip on older versions.
- **The README example** runs as written, so it can't drift from the API.

### Benchmark

```sh
pnpm -F steerkit bench
```

One frame of 1,000 agents, with `blend` and with `zero` + `add`: time and
bytes allocated per frame. Plain Node rather than Vitest, whose module
runner adds overhead to every imported call. A baseline to compare a change
against, not a CI gate: timings are too noisy for that.

## Code style

- Short comments in English that explain why, not what.
- Explicit names; no abbreviations beyond `out`, `dt` and vector components.
- Every behavior writes into an `out` vector passed last and returns it,
  reads all its inputs before writing (so `out` may alias any of them), and
  allocates nothing.

## Commits and branches

- [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):
  `feat: add separation`, `fix(step): …`, `docs: …`.
- `main` holds releases, `develop` the work in progress. Branch off
  `develop` (`feat/…`, `fix/…`, `chore/…`) and open the pull request
  against it; nothing is committed to `main` or `develop` directly.

## Releasing

Versions and the changelog come from [Changesets](https://github.com/changesets/changesets).

1. A pull request that changes the published package adds a changeset:
   `pnpm changeset`, then pick the bump and describe the change.
2. When `develop` is merged into `main`, the release workflow opens a
   "chore: release" pull request: version bump and `CHANGELOG.md`.
3. Merging that pull request publishes to npm, with provenance, through npm
   trusted publishing (no token).

**The first publish** is done by hand, since trusted publishing is set up
from the package's settings on npmjs.com, once the package exists. Merge the
"chore: release" pull request (0.1.0 and its CHANGELOG); the workflow's
publish step then fails for lack of npm credentials, which is expected. From
an up-to-date `main`:

```sh
pnpm install
pnpm -F steerkit build
cd packages/steerkit
npm pack            # try the tarball in a real project first
npm publish
```

Then, on npmjs.com, add `thibautlfr/steerkit` and `release.yml` as the
package's trusted publisher: later releases publish themselves. The release
workflow also needs "Allow GitHub Actions to create and approve pull
requests" in the repository's settings, and the demos need GitHub Pages set
to "GitHub Actions".
