---
name: pre-commit-check
description: Run Flowtra pre-commit checks and cleanup. Use when preparing to commit or push, or when the user says "check and commit", "clean up and push", or "prepare for GitHub".
---

# Pre-Commit Check

Follow this workflow in order. Stop on failure and report the failure.

## 1) Run build check

```bash
pnpm build
```

If it fails: report the error and stop.

## 2) Run type check

```bash
pnpm type-check
```

If it fails: report the error and stop.

## 3) Verify dependency lock

Check if `package.json` changed, then ensure `pnpm-lock.yaml` also changed.

```bash
git diff --name-only | rg -n "^package.json$"
```

If `package.json` changed:

```bash
git diff --name-only | rg -n "^pnpm-lock.yaml$"
```

If lock file missing, tell the user to run `pnpm install` and stop.

## 4) Remove temporary scripts

Look only in project root (not `scripts/`).

Patterns:
- `test-*.js`, `test-*.ts`
- `apply-*.sh`

Process:
1. Identify candidates.
2. Read files to confirm they are temporary.
3. Delete confirmed temporary files immediately:
   - Untracked files: `rm`
   - Tracked files: `git rm`

Never delete:
- `package.json`, `pnpm-lock.yaml`
- Anything under `scripts/`, `.claude/`, `node_modules/`
- Any `*-sound.sh` scripts

## 5) Confirm changes

Show `git status` and list files to be committed.

## 6) Commit

Use conventional commits. Example:

```bash
git add .
git commit -m "chore: pre-commit checks and cleanup"
```

If you need a detailed body, summarize: build/type checks, temp files removed.
Commit directly after checks pass. Do not ask for confirmation.

## 7) Push

Run `git push` automatically after commit succeeds. Do not ask whether to push.
