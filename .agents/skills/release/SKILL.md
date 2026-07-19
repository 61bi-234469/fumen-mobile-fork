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
3. You are on `develop` and it contains everything intended for release
   (`git log origin/main..develop --oneline` — show this list to the user).

## Validation (required before merging)

```bash
yarn lint
yarn test
yarn webpack-prod
```

All must pass. Additionally run the relevant Cypress specs (`.agents/skills/e2e/SKILL.md`)
when the released changes touch a flow with E2E coverage; if local E2E is not runnable
(GPU issue / timeout), verify the latest `dev-workflow` run on `develop` is green instead:

```bash
gh run list --workflow dev-workflow.yaml --branch develop --limit 3
```

Apply any `gh` environment notes from `AGENTS.local.md` (gitignored, optional) to
every `gh` command in this skill.

## Procedure

```bash
# Per AGENTS.md, commit as the repository owner's confirmed GitHub noreply identity
# (`<id>+<username>@users.noreply.github.com`). If it is not already known in this
# session, ask the user to confirm it. Never use a real email address, and never
# derive the identity automatically from git history or the environment.
git config user.name "<owner GitHub username>"
git config user.email "<owner confirmed noreply email>"

# push develop first if it has unpushed commits (needs its own user confirmation)
git push origin develop

git checkout main
git pull origin main
git merge --no-ff develop      # merge commit message in English
git push origin main           # ← this deploys; confirm with the user immediately before
git checkout develop
```

- Ask for explicit confirmation immediately before **each** push (develop and main).
- After pushing main, verify the deploy:

```bash
gh run list --workflow deploy.yml --branch main --limit 1
```

Report the run result and the deployed commit to the user. If the deploy workflow fails,
investigate before doing anything else; do not re-push blindly.
