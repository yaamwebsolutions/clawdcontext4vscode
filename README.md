# ClawdContext — Markdown OS for AI Coding Agents

Stop prompting. Start orchestrating.

ClawdContext is a VS Code extension for teams using AI coding agents with `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, `todo.md`, and `lessons.md`.
It treats those files as a system, not a pile of prompts.

Core idea:

- `CLAUDE.md` / `AGENTS.md` = invariants and memory
- `SKILL.md` = reusable procedures (on-demand)
- `todo.md` = local task state
- `lessons.md` = governed learning cache
- hooks/tests = deterministic enforcement (outside the extension)

ClawdContext helps you keep that system healthy with context-budget analysis, linting, governance checks, security scanning for skills, and quick-fix refactors.

## Why This Exists

Most teams fail in one of two ways:

- they put everything into one giant `CLAUDE.md`
- they keep adding rules forever and call it "learning"

That creates context bloat, contradictions, and instruction drift.

ClawdContext is built around the Markdown OS thesis:

> The problem is not Markdown.  
> The problem is putting the wrong kind of instructions in the wrong Markdown file.

This extension operationalizes that thesis inside VS Code.

## What Ships in v0.2.0

Current extension version in `package.json`: `0.2.0`

### Feature Map (Eureka Concepts → Product Features)

| Concept | What ClawdContext ships |
|---|---|
| Context = RAM | CER (Context Efficiency Ratio) dashboard + status bar |
| Kernel bloat | `KERNEL_BLOAT` diagnostics + bloat analysis command |
| Lessons drift / autoimmune behavior | TTL + governance metadata checks + CodeLens + prune/archive workflows |
| Three-body problem (contradictions) | Cross-file contradiction detection (`CONTRADICTION`) |
| Markdown compiler (`mdcc`) | Multi-rule diagnostics for agent markdown files |
| Kessler syndrome (debris accumulation) | `KESSLER_RISK` on oversized `lessons.md` |
| Lost-in-the-middle / position risk | Positional attention analysis + `LOST_IN_MIDDLE` diagnostics |
| OpenClaw / skill poisoning risk | `SKILL.md` security scanner + dashboard security table |
| Refactorability > static warnings | Quick-fix and refactor code actions |

## Key Capabilities

### 1) CER Dashboard (Context Efficiency Ratio)

ClawdContext estimates how much of the context window is consumed by always-loaded instructions vs. left for reasoning.

- status bar CER indicator
- context health tree view
- dashboard webview with layer breakdown
- "what-if" simulator (simulate adding tokens to always-loaded context)

Default thresholds used by the extension:

- `≥ 0.4` = healthy (research target: > 0.6)
- `0.2 – 0.4` = warning
- `< 0.2` = critical

Thresholds are configurable via `clawdcontext.cerWarningThreshold` and `clawdcontext.cerCriticalThreshold`.

### 2) Markdown OS Linter (`mdcc`-style checks)

The extension lints agent markdown files as a system, not isolated docs.

Examples of shipped diagnostics:

- `CER_CRITICAL`
- `CER_WARNING`
- `KERNEL_BLOAT`
- `PROCEDURE_IN_KERNEL`
- `HEURISTIC_IN_KERNEL`
- `KESSLER_RISK`
- `STALE_LESSON`
- `MISSING_METADATA`
- `DEPRECATED_PRESENT`
- `SKILL_NO_FRONTMATTER`
- `SKILL_TOO_LARGE`
- `CONTRADICTION`
- `LOST_IN_MIDDLE`
- positional dead-zone clustering warnings

### 3) Lessons Governance (not just a notes file)

`lessons.md` is treated as a governed memory layer.

ClawdContext adds:

- age-aware CodeLens badges on lesson entries
- TTL-based staleness detection (default 60 days)
- metadata enforcement (scope / type / confidence / source / status)
- prune and archive flows for deprecated entries
- promotion-candidate review support

### 4) Security Scanner for `SKILL.md`

ClawdContext scans skills for suspicious patterns inspired by real agent ecosystem attacks (OpenClaw / skill marketplace threat models).

Examples of pattern categories:

- exfiltration/network beacons
- credential access patterns
- code execution / shell abuse
- obfuscation / encoded payloads
- prompt override / injection-style manipulation
- persistence / recon behaviors

Outputs:

- per-skill security score
- verdict (`clean` / `suspicious` / `dangerous`)
- findings count in dashboard + diagnostics pipeline

### 5) Quick Fixes and Refactors (Code Actions)

ClawdContext does not stop at warnings; it provides refactors.

Examples of code actions in v0.2.0:

- extract procedure from `CLAUDE.md` → `skills/<name>/SKILL.md`
- move temporal heuristic from kernel → `lessons.md`
- add missing governance metadata
- mark stale lesson as deprecated / promotion candidate
- archive deprecated entries
- add missing `SKILL.md` frontmatter
- open kernel bloat analysis
- prune when `KESSLER_RISK` triggers

## The Markdown OS Model (What Goes Where)

### Layer 1 — Global invariants (`CLAUDE.md`, sometimes `AGENTS.md`)

Use for:

- architecture invariants
- critical security/compliance constraints
- essential commands
- short review checklist

Do not use for:

- long procedures
- local heuristics
- task state
- unvalidated lessons

### Layer 2 — Procedural knowledge (`SKILL.md`)

Use for:

- reusable workflows
- debug playbooks
- release checklists
- migration procedures

This is on-demand knowledge, not boot-time kernel config.

### Layer 3 — Task state (`todo.md`)

Use for:

- plan steps
- constraints
- done criteria
- blast radius / risks

### Layer 4 — Learning (`lessons.md`)

Use for:

- verified lessons
- root cause + prevention rule
- metadata + confidence + status
- promotion candidates

This layer needs pruning and governance or it becomes drift.

### Deterministic enforcement (hooks/tests)

ClawdContext reinforces the model, but hooks/tests are still the right place to guarantee behavior.

Message:

- Markdown guides
- hooks/tests guarantee

## Install

### VS Code Marketplace

Search for:

- `ClawdContext`

Or install by CLI:

```bash
code --install-extension clawdcontext.clawdcontext
```

### Local VSIX (from your `eurka` folder)

```bash
code --install-extension eurka/plugin_v2/clawdcontext-0.2.0.vsix
```

### Local VSIX (standalone extension repo)

```bash
code --install-extension ./clawdcontext-<version>.vsix
```

## Quick Start

1. Open a repo that contains any of:
   - `CLAUDE.md`
   - `AGENTS.md`
   - `SKILL.md`
   - `lessons.md`
   - `todo.md`
2. Run `ClawdContext: Analyze Workspace`
3. Open the ClawdContext sidebar (Layers / Health / Lessons)
4. Open the dashboard from the Health panel
5. Fix diagnostics via quick-fix code actions where available

No files yet? Run:

- `ClawdContext: Scaffold Markdown OS Templates`

## Commands

Commands declared in `package.json`:

- `ClawdContext: Analyze Workspace`
- `ClawdContext: Open Dashboard`
- `ClawdContext: Lint .md Agent Files`
- `ClawdContext: Generate Context Health Report`
- `ClawdContext: Prune Stale Lessons`
- `ClawdContext: Review Promotion Candidates`
- `ClawdContext: Scaffold Markdown OS Templates`
- `ClawdContext: Extract Procedure to SKILL.md`
- `ClawdContext: Move Heuristic to lessons.md`
- `ClawdContext: Archive Deprecated Entries`
- `ClawdContext: Analyze Kernel Bloat`

## Configuration

Key settings:

- `clawdcontext.tokenBudget` (default `200000`)
- `clawdcontext.cerWarningThreshold` (default `0.4`)
- `clawdcontext.cerCriticalThreshold` (default `0.2`)
- `clawdcontext.lessonsTtlDays` (default `60`)
- `clawdcontext.lessonsMaxEntries` (default `50`)
- `clawdcontext.alwaysLoadedFiles`
- `clawdcontext.onDemandPatterns`
- `clawdcontext.enableCodeLens`
- `clawdcontext.enableStatusBar`

## Supported Ecosystems / File Conventions

ClawdContext is designed around Claude Code / OpenClaw-style markdown workflows, but the concepts generalize.

Examples:

- Claude Code (`CLAUDE.md`, `.claude/`)
- OpenClaw / skill-based agents (`SKILL.md`, skills folders)
- Codex CLI / agent repos (`AGENTS.md`)
- custom markdown-based agent stacks

## Research and Reading (Why the model matters)

This extension is informed by the same research and field observations in your ClawdContext content stack.

Recommended reading:

- ClawdContext article: "Your AI Agent Has 200K Tokens of RAM — And You're Wasting 80% of It"
  - https://clawdcontext.com/en/blog/ai-agent-200k-tokens-ram-wasting-80-percent
- AGENTS.md evaluation paper
  - https://arxiv.org/abs/2602.11988
- SkillsBench (curated skills vs self-generated)
  - https://arxiv.org/abs/2602.12670

## What ClawdContext Is (and Is Not)

ClawdContext is:

- a VS Code analyzer for agent markdown systems
- a governance tool for `lessons.md`
- a context-budget / CER monitor
- a refactoring assistant for splitting kernel vs skills

ClawdContext is not:

- a replacement for tests/hooks/CI gates
- an execution sandbox
- a full policy engine
- a guarantee that agent behavior is secure by text alone

## Development (local)

```bash
cd <clawdcontext-extension-repo>
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Open Source (Contribute / Report / Discuss)

ClawdContext is prepared to run as a standalone open-source extension repo.

Start here:

- `CONTRIBUTING.md` — development workflow and PR standards
- `CODE_OF_CONDUCT.md` — community expectations
- `SECURITY.md` — private vulnerability reporting guidance
- `SUPPORT.md` — where to ask what
- `ROADMAP.md` — near-term priorities and contributor opportunities
- `PUBLISHING.md` — VS Code Marketplace + Open VSX release flow
- `GITHUB_SETUP.md` — branch protection and repo launch checklist

If you split the extension into its own repository (recommended), update `package.json` repository/bugs/discussions URLs before the first public release.

## Repo Structure (source tree)

```text
clawdcontext/
├── src/
│   ├── analyzers/
│   │   ├── tokenAnalyzer.ts
│   │   ├── diagnosticsProvider.ts
│   │   └── securityScanner.ts
│   ├── providers/
│   │   ├── treeProvider.ts
│   │   ├── statusBar.ts
│   │   ├── codeLensProvider.ts
│   │   └── codeActionProvider.ts
│   ├── test/
│   │   └── smoke.ts
│   ├── utils/
│   │   └── scaffold.ts
│   └── extension.ts
├── media/
├── package.json
└── README.md
```

Current workspace note:

- In your website repo, the extension source currently lives at `eurka/plugin_v2/clawdcontext/`

## License

MIT

## Closing Thesis

The future of AI coding is not just better prompting.
It is better orchestration, better memory hygiene, and better separation of concerns — with Markdown used deliberately, not dumped indiscriminately.
