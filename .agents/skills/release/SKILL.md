---
name: release
description: Production release for this repo — merge develop into main and push, which deploys to GitHub Pages. Use when the user asks to デプロイ / deploy / release / merge develop into main.
---

# Production release (develop → main → GitHub Pages)

A push to `main` triggers `.github/workflows/deploy.yml` and publishes the site.
"デプロイ" always means this procedure. Never commit directly to `main`.

## Preconditions

1. Confirm the user explicitly approved releasing to production **in this conversation**.
   Approval to push `develop` is NOT approval to merge into `main`.
2. Working tree: `git status` — unrelated user changes stay untouched; do not release
   with uncommitted changes that belong to the release.
3. You are on `develop` and it contains everything intended for release. Run
   `git fetch origin` first, then `git log origin/main..develop --oneline` and show this list
   to the user.
4. If that list contains user-visible UI or workflow changes, ask the user whether the user
   manual should be updated before the release (`.agents/skills/update-user-manual/`). Do not
   update the manual without that explicit request.

## Validation (required before merging)

```bash
yarn lint
yarn typecheck
yarn test
yarn webpack-prod
yarn check-build-performance   # deploy.yml fails on the same precache budget
yarn check-sold-slear-exclusion  # the production build must not contain the Sold Slear dev bot
```

All must pass. Sold Slear is published only in the develop preview (`SOLD_SLEAR_ENABLED`); do not set
`SOLD_SLEAR_ENABLED=true` for the production build without a separate explicit user approval. Additionally run the relevant Cypress specs (`.agents/skills/e2e/SKILL.md`)
when the released changes touch a flow with E2E coverage. If local E2E is not runnable
(GPU issue / timeout), a green `dev-workflow` run may stand in only for the exact commit
being released:

1. Push `develop` first (see Procedure) so CI runs on the release commit.
2. Wait for the `dev-workflow` run whose `headSha` equals `git rev-parse develop` to finish
   with `conclusion: success`. A green run on an older `develop` commit does not count.

```bash
git rev-parse develop
gh run list --workflow dev-workflow.yaml --branch develop --limit 5 --json headSha,status,conclusion,url
```

Apply any `gh` environment notes from `AGENTS.local.md` (gitignored, optional) to
every `gh` command in this skill.

## Procedure

```bash
# Per AGENTS.md, the merge commit must use the owner's GitHub noreply identity, which is
# already set in this repository's local git config. Only verify it; never run
# `git config user.*` or override the author/committer. If it is missing or not the noreply
# address, stop and ask the user.
git config user.name
git config user.email

# push develop first if it has unpushed commits (per AGENTS.md, no confirmation needed)
git push origin develop
# if local E2E was not runnable, wait here for the green dev-workflow run on this exact SHA

git checkout main
git pull origin main
git merge --no-ff develop      # merge commit message in English
git push origin main           # ← this deploys; confirm with the user immediately before
git checkout develop
```

- Pushing `develop` needs no extra confirmation (AGENTS.md). Ask for explicit confirmation
  immediately before the `main` push.
- A push to `develop` starts `dev-workflow` and also `deploy.yml`, which republishes the
  preview and rebuilds production from the current `main`.
- After pushing main, verify the deploy:

```bash
gh run list --workflow deploy.yml --branch main --limit 1
```

Report the run result and the deployed commit to the user. If the deploy workflow fails,
investigate before doing anything else; do not re-push blindly.
