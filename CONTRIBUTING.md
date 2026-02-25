# Contributing to ClawdContext

ClawdContext is a VS Code extension for managing AI-agent Markdown systems (`CLAUDE.md`, `AGENTS.md`, `SKILL.md`, `todo.md`, `lessons.md`) as an engineered stack.

This project aims to be:

- technically credible
- useful in real workflows
- safe by default
- contributor-friendly

## Before You Start

- Check `README.md` for product scope and current feature set
- Search existing issues and discussions before opening a new one
- Use issues for concrete bugs / proposals
- Use discussions for strategy, ecosystem, and research framing

## Contribution Types We Want

- Bug fixes (false positives/negatives, command bugs, UI issues)
- New diagnostics (high-signal, low-noise)
- Better code actions and refactors
- Security scanner improvements (`SKILL.md` threat patterns)
- Performance improvements for large repos
- Docs, examples, and sample Markdown OS repos
- Tests and CI hardening

## Local Development

### Prerequisites

- Node.js 20+
- VS Code 1.85+

### Setup

```bash
cd eurka/plugin_v2/clawdcontext
npm install
npm run compile
```

### Run the Extension

1. Open `eurka/plugin_v2/clawdcontext` in VS Code
2. Press `F5` to start an Extension Development Host
3. Open a test workspace containing agent markdown files
4. Run `ClawdContext: Analyze Workspace`

## Commands

- `npm run compile` — TypeScript build
- `npm run lint` — ESLint on `src/`
- `npm test` — smoke validation for build output/manifest
- `npm run check` — compile + lint + smoke
- `npm run package` — produce `.vsix`

## Engineering Standards

### General

- Keep changes scoped and reviewable
- Prefer explicit logic over opaque heuristics
- Document tradeoffs in PR descriptions
- Do not silently weaken diagnostics to reduce noise; explain threshold changes

### Diagnostics

When adding or changing diagnostics:

- include a stable diagnostic code
- make the message actionable
- avoid duplicate warnings for the same root cause
- add or update a code action when a deterministic fix is possible
- explain false-positive risk in the PR

### Security Scanner (`SKILL.md`)

Security scanning is advisory. It is not a sandbox or malware guarantee.

When adding patterns:

- tie the rule to a clear threat behavior
- prefer explainable pattern logic
- avoid “security theater” rules with high noise
- document limitations

## Pull Requests

### Branching

- Create a feature branch from `main`
- Do not push directly to `main` (branch protection is expected)

### PR Checklist

- [ ] Scope is clear and minimal
- [ ] `npm run check` passes locally
- [ ] `.vsix` packaging still works (`npm run package`)
- [ ] README/docs updated if behavior changed
- [ ] Screenshots or GIFs attached for UI changes
- [ ] Release note impact described

## Commit Style (Recommended)

Conventional-style prefixes make changelogs and release notes easier:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `perf:`
- `test:`
- `chore:`

## Design Direction (Top 1% Bar)

ClawdContext should feel opinionated and useful, not noisy.

We bias toward:

- high-signal diagnostics
- actionable quick fixes
- measurable context quality (CER, token budgets)
- strong security posture messaging without overclaiming

## Questions?

- Product/help questions: use GitHub Discussions (recommended)
- Bugs: open an issue using the bug form
- Security concerns: follow `SECURITY.md`
