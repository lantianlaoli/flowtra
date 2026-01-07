---
name: pre-commit-check
description: Run build checks, type checks, remove temporary scripts, and commit to GitHub. Use when preparing to commit code, before pushing, or when the user says "check and commit", "clean up and push", or "prepare for GitHub".
allowed-tools: Bash, Glob, Read, Edit
---

# Pre-Commit Check

This Skill automates the pre-commit workflow for this project: running build and type checks, cleaning up temporary files, and committing to GitHub.

## Workflow Steps

When this Skill is activated, follow these steps in order:

### 1. Run Build Check

```bash
pnpm build
```

**Success criteria**: Exit code 0, no build errors

**If build fails**:
- Report the error to the user
- Do NOT proceed to the next step
- Ask if they want to fix the errors first

### 2. Run Type Check

```bash
pnpm type-check
```

**Success criteria**: Exit code 0, no TypeScript errors

**If type check fails**:
- Report the errors to the user
- Do NOT proceed to the next step
- Ask if they want to fix the errors first

### 3. Remove Temporary Scripts

Search for and remove temporary script files. These are typically test scripts created during development.

**Patterns to look for**:
- Files matching `*-sound.sh` in the project root
- Files matching `test-*.js` or `test-*.ts` in the project root (NOT in `tests/` directory)
- Files matching `apply-*.sh` in the project root
- Any files the user specifically mentions as temporary

**How to identify temporary scripts**:
1. Use Glob to find files: `*.sh`, `test-*.js`, `test-*.ts` in project root
2. Read each file to verify it's a temporary test script (not a legitimate project script)
3. Check git status to see if these files are tracked or untracked
4. List all temporary files found and ask for confirmation before deletion

**Deletion process**:
```bash
# For untracked files
rm filename.sh

# For tracked files (need to be removed from git)
git rm filename.sh
```

**Files to NEVER delete** (production scripts):
- `package.json`
- `pnpm-lock.yaml`
- Scripts in `scripts/` directory
- Scripts in `.claude/` directory (unless user confirms)
- Any file in `node_modules/`

### 4. Verify Changes

Before committing, show the user:
1. Current git status
2. List of files that will be committed
3. List of temporary files that were removed

Ask for confirmation to proceed with commit.

### 5. Create Git Commit

If user confirms, create a commit following the project's conventional commit format:

```bash
git add .
git commit -m "$(cat <<'EOF'
chore: pre-commit checks and cleanup

- ✅ Build check passed
- ✅ Type check passed
- 🧹 Removed temporary scripts: [list files]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"
```

**Commit message format**:
- Type: `chore` (for cleanup and checks)
- Subject: Clear description of what was done
- Body: Checklist of completed tasks
- Footer: Claude Code signature and co-author

### 6. Push to GitHub (Optional)

Ask the user if they want to push to GitHub:
- If yes: Run `git push`
- If no: Remind them to push later

## Error Handling

- If build fails: Stop and report errors
- If type check fails: Stop and report errors
- If git operations fail: Report error and suggest fixes
- If uncertain about deleting a file: Always ask for confirmation

## Example Usage

**User says**: "Check and commit"

**Skill executes**:
1. ✅ Build check passed
2. ✅ Type check passed
3. 🔍 Found temporary files:
   - `task-complete-sound.sh` (untracked)
   - `test-openrouter.js` (untracked)
4. 🧹 Removed 2 temporary files
5. 💾 Created commit with cleanup summary
6. 🚀 Pushed to GitHub

## Notes

- This Skill follows the project's pre-deployment checklist from `CLAUDE.md`
- Temporary script detection is conservative - when in doubt, ask the user
- Never delete files without user confirmation
- Always run checks in order (build → type check → cleanup → commit)
