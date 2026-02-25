# Marketplace Readiness (Top 1% Launch)

Use this file before every public release that targets discoverability, installs, and trust.

## 1) Listing Copy (Ready to Use)

### Display Name

`ClawdContext — Markdown OS for AI Agents`

### Short Description (`package.json` description)

VS Code extension for AI coding agent Markdown systems: CER dashboard, mdcc-style diagnostics, lessons governance, SKILL.md security scanning, and quick-fix refactors.

### Marketplace Tagline (for posts/screenshots)

Stop prompting. Start orchestrating.

### Long Description (Store / README opener variant)

ClawdContext is a VS Code extension for teams using AI coding agents with `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, `todo.md`, and `lessons.md`.
It treats those files as an engineered system, not a pile of prompts.

It helps you:

- measure context efficiency (CER)
- detect kernel bloat and instruction drift
- govern `lessons.md` with TTL and metadata checks
- scan `SKILL.md` files for suspicious patterns
- apply quick-fix refactors to split kernel vs on-demand procedures

## 2) Categories + Keywords (Current Recommended Set)

### Categories (`package.json`)

- `Linters`
- `Visualization`
- `Machine Learning`
- `Other`

### Keywords (`package.json`)

Focus:

- AI agent workflows
- Markdown OS / agent memory files
- context engineering
- security/governance

Current optimized set is maintained in `package.json`.

## 3) Screenshot / GIF Checklist (Must-Have)

### Core Screenshots (minimum 4)

- [ ] ClawdContext sidebar showing Layers / Health / Lessons
- [ ] CER dashboard (healthy state) with layer breakdown
- [ ] CER dashboard what-if slider (critical state)
- [ ] Problems panel with diagnostics + lightbulb code actions

### High-Impact GIFs (minimum 2)

- [ ] Quick fix: extract procedure from `CLAUDE.md` into `SKILL.md`
- [ ] `lessons.md` governance flow (stale entry -> deprecate/archive)

### Optional but Strong

- [ ] `SKILL.md` security scanner table in dashboard
- [ ] Lost-in-the-middle positional heatmap
- [ ] Scaffold Markdown OS templates command in a blank repo

## 4) Screenshot/GIF Quality Bar

- Use a clean demo workspace with readable markdown
- Use a consistent theme (dark or light) across all assets
- Crop tightly to the value moment (avoid full-screen clutter)
- Ensure text is readable at small preview sizes
- Redact any local paths/usernames if shown
- Keep GIFs short (6-15 seconds), one action per GIF

## 5) Demo Workspace Fixture (Recommended)

Create a small public sample repo for visuals:

- `CLAUDE.md` with 1-2 intentional issues
- `lessons.md` with stale + missing metadata entries
- `skills/debug-ci/SKILL.md` with one suspicious pattern example
- `todo.md` plan file

This gives consistent screenshots and reproducible demos for contributors.

## 6) Launch Checklist (Marketplace + GitHub)

- [ ] `npm run check` passes
- [ ] `npm run package` produces `.vsix`
- [ ] README badges and install CTA render correctly
- [ ] `CHANGELOG.md` updated for the release version
- [ ] Tag matches `package.json` version (`vX.Y.Z`)
- [ ] CI green on `main`
- [ ] Secret Scan workflow green
- [ ] Marketplace screenshots/GIFs uploaded
- [ ] Open VSX publish confirmed (if applicable)
- [ ] GitHub Release includes `.vsix` asset

## 7) Post-Launch (Stars + Adoption)

First 72 hours:

- Respond to every issue/discussion quickly
- Pin one “How to use ClawdContext in 5 minutes” discussion
- Post short demos from the same assets used in Marketplace
- Link from relevant ClawdContext blog posts on `clawdcontext.com`
- Create 3 `good first issue` tasks from real feedback

## 8) Don’t Overclaim

ClawdContext improves visibility, hygiene, and governance for AI-agent Markdown workflows.

It does **not** guarantee secure execution or eliminate prompt injection by itself.
