# Changelog

## [0.5.5] — 2026-03-17

### Fixed
- **Full cross-platform OS support** — Extension now works on macOS, Linux, AND Windows
- **osWorkspace.ts** — Replaced all `exec()` shell commands with `execFile()` (no shell dependency). Git clone, Docker compose, curl check, and install script all use cross-platform invocations
- **serverManager.ts** — OS-aware Python venv discovery (Unix `bin/` vs Windows `Scripts/`), OS-appropriate setup command (`./run.sh` vs `.\run.ps1`), and reliable process termination (`taskkill` on Windows vs `SIGTERM` on Unix)
- **provider.ts** — Tilde (`~`) expansion now uses `os.homedir()` instead of `process.env.HOME` (which is undefined on Windows)
- **templates.ts** — Script generation detects OS: shell archetypes produce PowerShell (`.ps1`) on Windows and Bash (`.sh`) on Unix. Scaffold Pipeline (Archetype F) generates both `.sh` and `.ps1` scripts

## [0.5.4] — 2026-03-17

### Added
- **Model context window registry** — Auto-detects context window size from your configured AI model (35 models across OpenAI, Anthropic, DeepSeek, Ollama). CER calculations now use the correct budget without manual configuration.
- **Dashboard budget source indicator** — Metrics panel shows where the token budget comes from: model name, manual override, or default

### Fixed
- **Branding consistency** — Replaced 6 Claude-specific references with generic "AI agent" wording across Skill Forge UI, prompts, generator labels, and settings descriptions

## [0.5.3] — 2026-03-16

### Added
- **Dedicated generate timeout** — AI generation uses 180s timeout (configurable) instead of sharing the 30s general timeout. Prevents false fallback to templates.
- **Visible errors** — Generate errors now shown via `showWarningMessage` with actual error message instead of silent fallback
- **Install hint** — Offline mode shows a link to install the local backend

### Fixed
- **Generate timeout causing template fallback** — AI generation makes 6+ LLM calls taking 45–120s; the 30s timeout caused silent fallback to templates
- **Silent error swallowing** — Catch block in generate handler now shows the actual error

### Removed
- **Cloud fallback** — Removed cloud backend (`sfs.clawdcontext.com`). All AI processing is local-only: your API keys never leave your machine. Modes simplified to **● Online** (local backend) and **○ Offline** (templates).

### New Settings
- `clawdcontext.skillForge.generateTimeout` — AI generation timeout in seconds (default: 180, range: 30–600)

## [0.5.2] — 2026-03-16

### Fixed
- **Default OpenAI model updated from `gpt-4o` to `gpt-4.1-mini`** — `gpt-4o` was sunset by OpenAI, causing all AI features (AI Validate, AI Review, AI Generate, Contradictions) to fail with "completer not found" error
- Azure OpenAI default also updated to `gpt-4.1-mini`
- Settings descriptions updated to reflect new defaults

## [0.5.1] — 2026-03-16

### Improved
- **Skill Forge modular AI architecture** — Generation pipeline refactored from monolithic single-call to modular orchestrator
  - Each file type (SKILL.md, scripts, references, templates, agents, evals) has its own specialized AI module with focused prompt
  - Phase 1 (SKILL.md first) → Phase 2 (parallel generation via asyncio) → Phase 3 (scaffolding)
  - Per-module fallback: if one module's AI call fails, only that module degrades to template — others keep AI quality
- **Agent Skills 2.0 eval harness** — New `evals_gen` module generates evaluation files (evals.json, quality-rubric.md, validate script) following agentskills.io methodology
- **Offline template eval support** — `buildEvalsJson()` and `buildQualityRubric()` added to extension templates for offline mode

## [0.5.0] — 2026-03-14

### Added
- **Skill Forge Studio integration** — Create production-quality SKILL.md bundles directly from VS Code
  - `ClawdContext: Create Skill with Skill Forge` — 8-step wizard (Elicitate → Architect → Generate → Validate → Iterate → Export)
  - `ClawdContext: Toggle Skill Forge Server` — Start/stop the SFS Python backend from the status bar
  - **Online mode**: Full SFS backend integration (recommend, generate, validate, export via REST API)
  - **Offline mode**: Template-based generation for all 7 archetypes when backend is unavailable
  - **AI bridge**: Forwards extension AI settings (OpenAI, Anthropic, Azure, DeepSeek, Ollama) to SFS backend
  - **Auto-start**: Optional background start of SFS Python backend (`skillForge.autoStart` setting)
  - **File output**: Writes generated skills directly to `.clawdcontext/skills/` in the workspace

### New Settings
- `clawdcontext.skillForge.serverUrl` — SFS backend URL (default: `http://localhost:8742`)
- `clawdcontext.skillForge.apiKey` — API key for authenticated SFS backends
- `clawdcontext.skillForge.autoStart` — Auto-start SFS backend on extension activation

### Architecture
- 7 new source files in `src/skillForge/`: sfsClient, serverManager, aiBridge, webviewHtml, skillForgePanel, templates, index
- Zero new npm dependencies (HTTP client uses Node.js built-in `http`/`https`)
- Vanilla HTML/CSS/JS webview (no bundler, no React)

## [0.4.1] — 2026-02-26

### Fixed
- Corrected command count in README: 15 core + 11 AI = 26 total
- Updated Marketplace README for conversion optimization (463 → 201 lines)

## [0.4.0] — 2026-02-26

### Added
- **CER diff tracking** — Compare context efficiency between git commits to pinpoint what changed CER
- **Config presets** — `strict`, `balanced`, `permissive` workspace profiles for different team policies
- **Dashboard export** — Save dashboard state as JSON or Markdown report artifacts
- **Optional AI capabilities** — Multi-provider support (OpenAI, Anthropic/Claude, Azure OpenAI, Ollama, DeepSeek) with enterprise mTLS/CA certificate support
  - `AI: Test Connection` — verify provider setup
  - `AI: Review Agent Config` — AI-powered CER and kernel optimization suggestions
  - `AI: Explain Diagnostic` — context-aware diagnostic explanations
  - `AI: Suggest Refactor` — AI-powered extraction recommendations (kernel → skills)
  - `AI: Security Review` — deep semantic security analysis beyond regex patterns
  - `AI: Validate Agent Files` — full workspace validation with quality gates
  - `AI: Validate This File` — single-file AI validation
  - `AI: Generate Missing Files` — scaffold missing agent files from project context
  - `AI: Generate / Regenerate File` — generate specific agent file (CLAUDE.md, SKILL.md, etc.)
  - `AI: Fix Violations` — auto-fix diagnostics using AI with safe path handling
  - `AI: Detect Contradictions` — semantic contradiction analysis across agent files
- **Security scanner allowlist** — Suppress specific SEC_* rule codes for first-party skills
- **Trusted domains** — Whitelist domains for SEC_EXFIL_FETCH pattern matching
- **Code-block awareness** — Automatically suppress findings inside markdown fenced code blocks and inline backticks
- **UI/UX overhaul** — Editor context menus, explorer context menus, submenus, walkthrough onboarding
- **Interactive dashboard** — Buttons with postMessage for direct actions (analyze, export, bloat analysis)

### Changed
- Expanded SKILL.md security scanner with 4 new pattern categories: supply-chain, SSRF, path traversal, privilege escalation (17 → 21 patterns)
- Dashboard now shows AI provider status card
- Security table shows active vs suppressed finding counts
- Added 27 settings, 8 menu contribution points, 2 submenus, 1 walkthrough
- Total commands: 26 (15 core + 11 AI)
- AI providers: 5 (OpenAI, Anthropic, Azure OpenAI, Ollama, DeepSeek)

### Security
- **Path traversal prevention** — All AI-generated file paths validated with `sanitizePath()`: rejects absolute paths, `../` traversal, control chars, and writes outside known agent paths
- **Shell injection fix** — All `execSync` calls in CER diff tracking replaced with `execFileSync` using argument arrays (no shell interpolation)
- **CER threshold config respected** — CER warning/critical settings now apply as direct CER cutoffs (matching setting names/docs)
- **Prune lessons loop fix** — Fixed early exit that skipped remaining lesson files after the first clean file
- **Lint cleanup** — Resolved all ESLint warnings: consistent type imports, empty catch blocks, unused variables
- **Smoke test coverage** — Added targeted assertions for path sanitization and CER threshold classification

## [0.3.0] — 2026-02-25

### Added
- **Modular command architecture** — Commands extracted into `src/commands/` module (analyzeWorkspace, lessonsCommands, generateReport, showDashboard)
- **Barrel exports** — `src/analyzers/index.ts`, `src/providers/index.ts`, `src/commands/index.ts` for clean imports
- **Multi-platform CI** — Matrix testing on Ubuntu, macOS, Windows; Node.js 20 + 22
- **README badges** — Marketplace version, installs, license, CI status, stars, PRs welcome
- **Install CTA** — One-click Marketplace install button in README
- **Star History chart** — Embedded in README
- **`.nvmrc` + `.node-version`** — Pin Node.js 22 for contributors

### Changed
- **extension.ts** — Reduced from 257 to ~105 lines (thin wiring layer)
- **Dashboard** — Extracted from extension.ts into `src/commands/showDashboard.ts` with decomposed render functions
- **CI workflow** — Now runs on push to `main` and `develop` branches; explicit `permissions: contents: read`
- **Release workflow** — Uses `npm ci` instead of fallback logic
- **README** — Restructured with feature table, Markdown OS model, contributing guide, star history chart
- **CODEOWNERS** — Added `src/commands/*` path

### Removed
- `GITHUB_SETUP.md` — Redundant (content in CONTRIBUTING.md)
- `PUBLISHING.md` — Redundant (content in CONTRIBUTING.md)
- Committed `.vsix` artifact — Now only published via CI/CD releases

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
