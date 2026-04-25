# Releasing Turul

Trunk-based, tag-driven. `main` is always shippable; releases happen when a `vX.Y.Z` tag is pushed.

## Prerequisites

- You are up to date with `origin/main` (`git pull --ff-only origin main`).
- CI is green on the commit you want to release.
- Working tree is clean (`git status` shows nothing).

## Release a stable version

```bash
# 1. Bump version (creates a chore commit + tag locally)
npm version patch         # or `minor` / `major`

# 2. Push branch and tag together
git push --follow-tags
```

The push of `vX.Y.Z` triggers `.github/workflows/release.yml`, which:

1. Runs Trivy + `npm audit` security scans.
2. Builds macOS (arm64, x64), Windows (x64, arm64), Linux (x64, arm64).
3. Verifies the tag matches `package.json`.
4. Publishes a GitHub Release with all artifacts and auto-generated notes.

## Release a pre-release

```bash
npm version prerelease --preid=rc   # → vX.Y.Z-rc.0
git push --follow-tags
```

Tags matching `vX.Y.Z-*` (e.g. `-rc.0`, `-beta.1`, `-alpha.2`) are published as **pre-release** on GitHub and are *not* marked `--latest`.

## Manual / emergency release

If you need to rebuild artifacts for an existing tag without touching version, trigger `Build & Release` via **Actions → Build & Release → Run workflow** (`workflow_dispatch`). This uses the version in `package.json` on the dispatched ref.

## Versioning policy

We follow [SemVer](https://semver.org/):

- **PATCH** — bug fixes, security patches, dependency bumps.
- **MINOR** — new features, backward-compatible changes.
- **MAJOR** — breaking changes (renamed IPC channels, removed scanners, schema migrations that aren't backward-compatible).

## Branching

- `main` — always shippable; protected.
- `feature/<short-name>` or `fix/<short-name>` — short-lived, merged via PR.
- `dependabot/*` — auto-managed, merged once CI passes.

## Hotfixes

For an urgent fix on the latest stable:

```bash
git switch -c fix/<topic> origin/main
# work, commit
gh pr create -B main --fill
# after merge
npm version patch && git push --follow-tags
```

If `main` has unreleased work that you don't want to ship yet, branch from the last release tag instead, fix, merge, and tag a `vX.Y.(Z+1)` from that branch.
