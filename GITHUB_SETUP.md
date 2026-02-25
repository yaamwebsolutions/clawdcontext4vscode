# GitHub Setup (Repo Launch + Branch Protection)

Use this checklist when you create the dedicated extension repo (recommended: `clawdcontext-vscode`).

## Recommended Repo Names

- `clawdcontext-vscode` (best default)
- `clawdcontext-extension`
- `clawdcontext-mdcc`

## Repo Description (Suggested)

VS Code extension for AI coding agent Markdown systems: CER dashboard, Markdown OS diagnostics, lessons governance, `SKILL.md` security scanning, and quick-fix refactors.

## Suggested Topics

- `vscode-extension`
- `ai-agents`
- `claude-code`
- `markdown`
- `developer-tools`
- `security`
- `llm`
- `agentic-ai`

## Branch Protection / Ruleset for `main` (Recommended)

Protect `main` before inviting contributions.

Enable:

- Require a pull request before merging
- Require at least 1 approval
- Dismiss stale approvals when new commits are pushed
- Require conversation resolution before merging
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Block force pushes
- Block deletions
- Include administrators

### Required Status Checks (after first CI run)

- `validate`

## Merge Strategy

Recommended:

- Allow squash merges: `on`
- Allow rebase merges: `on`
- Allow merge commits: `off`

## GitHub Features to Enable

- Issues
- Discussions (strongly recommended)
- Security advisories
- Projects (optional)
- Wiki (optional, usually not needed at start)

## Labels (Starter Set)

- `bug`
- `enhancement`
- `docs`
- `good first issue`
- `help wanted`
- `security`
- `false-positive`
- `false-negative`
- `performance`
- `marketplace`

## Secrets to Add (for release workflow)

- `VSCE_PAT`
- `OVSX_PAT`

## First 30 Days Launch Rhythm (Stars + Trust)

- Ship 2-4 releases quickly
- Respond to issues within 24-72h
- Convert feedback into visible roadmap items
- Publish short demo clips (CER dashboard, quick-fix extraction, security scanner)
- Link back to the research articles on `clawdcontext.com`
