# Changelog

## [0.2.1] — 2026-02-25

### Changed
- Bump minimum VS Code engine to `^1.96.0`
- Bump CI/CD to Node.js 22 LTS
- Migrate ESLint to v9 flat config (`eslint.config.mjs`)
- Update all dev dependencies to latest stable
- Align CER threshold documentation with extension defaults (`0.4` warning, `0.2` critical)
- Add tag guard to Marketplace / Open VSX publish steps in release workflow
- Exclude community docs from `.vsix` package (`.vscodeignore`)
- Finalize security reporting channels in `SECURITY.md`
- Rename smoke test to `smoke.ts` for clarity

## [0.2.0] — 2026-02-25

### Added
- **Quick Fix Code Actions** — Extract procedures to `SKILL.md`, move heuristics to `lessons.md`, archive deprecated entries, and patch missing metadata/frontmatter
- **SKILL.md Security Scanner** — Pattern-based detection for exfiltration, prompt overrides, code execution, obfuscation, and credential access risks
- **Positional Analysis** — `LOST_IN_MIDDLE` and dead-zone clustering diagnostics for critical instructions buried in the middle of always-loaded files
- **What-If CER Simulator** — Dashboard slider to project CER degradation as boot-time context grows
- **Kernel Bloat Breakdown** — Interactive analysis flow for token-heavy sections in `CLAUDE.md` / `AGENTS.md`

### Changed
- Improved token estimation accuracy (replacing simple `chars/4` approximation)
- Expanded dashboard with security and positional-risk visualizations
- Added publish-readiness metadata and scripts to the extension manifest

## [0.1.0] — 2026-02-25

### Added
- **CER Dashboard** — Context Efficiency Ratio monitoring with status bar gauge and full webview dashboard
- **mdcc Linter** — 12 diagnostic rules across kernel, skill, learning, and cross-file layers
- **6-Layer Architecture View** — Sidebar panel showing Markdown OS structure with token counts
- **Lessons Governance** — CodeLens annotations with age tracking, TTL, staleness detection, promotion candidates
- **Contradiction Detection** — Cross-file analysis catching conflicting instructions between layers
- **Scaffold Templates** — One-command generation of CLAUDE.md, todo.md, lessons.md, AGENTS.md, SKILL.md
- **Health Report** — Exportable markdown report of context health metrics
- **File Watchers** — Auto-refresh on any agent file change
- **Configurable budgets** — Token budget, CER thresholds, TTL, max entries all configurable
