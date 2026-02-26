# ClawdContext — Markdown OS for AI Coding Agents

[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/clawdcontext.clawdcontext?label=VS%20Code%20Marketplace&logo=visual-studio-code&color=0078d7)](https://marketplace.visualstudio.com/items?itemName=clawdcontext.clawdcontext)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/clawdcontext.clawdcontext?logo=visual-studio-code&color=059669)](https://marketplace.visualstudio.com/items?itemName=clawdcontext.clawdcontext)
[![License: MIT](https://img.shields.io/github/license/yaamwebsolutions/clawdcontext4vscode?color=blue)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/yaamwebsolutions/clawdcontext4vscode/ci.yml?branch=main&label=CI&logo=github)](https://github.com/yaamwebsolutions/clawdcontext4vscode/actions/workflows/ci.yml)
[![Secret Scan](https://img.shields.io/github/actions/workflow/status/yaamwebsolutions/clawdcontext4vscode/secret-scan.yml?branch=main&label=Secret%20Scan&logo=github)](https://github.com/yaamwebsolutions/clawdcontext4vscode/actions/workflows/secret-scan.yml)
[![GitHub Stars](https://img.shields.io/github/stars/yaamwebsolutions/clawdcontext4vscode?style=social)](https://github.com/yaamwebsolutions/clawdcontext4vscode)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

**Stop prompting. Start orchestrating.**

> *Part of the [ClawdContext](https://clawdcontext.com) AI Security Ecosystem*

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=clawdcontext.clawdcontext">
    <img src="https://img.shields.io/badge/Install_from_Marketplace-0078d7?style=for-the-badge&logo=visual-studio-code&logoColor=white" alt="Install from Marketplace" />
  </a>
</p>

<p align="center">
  <img src="media/demo.png" alt="ClawdContext — CER dashboard and context health overview" width="640" />
</p>

<p align="center">
  <img src="media/demo1.png" alt="ClawdContext — Markdown OS linter diagnostics and quick fixes" width="640" />
</p>

<p align="center">
  <img src="media/demo2.png" alt="ClawdContext — Security scanner and lessons governance" width="640" />
</p>

---

ClawdContext is a VS Code extension for teams using AI coding agents with `CLAUDE.md`, `AGENTS.md`, `SKILL.md`, `todo.md`, and `lessons.md`.
It treats those files as a **system**, not a pile of prompts.

| File | Role |
|---|---|
| `CLAUDE.md` / `AGENTS.md` | Invariants and memory (kernel) |
| `SKILL.md` | Reusable procedures (on-demand) |
| `todo.md` | Local task state |
| `lessons.md` | Governed learning cache |
| hooks / tests | Deterministic enforcement |

ClawdContext keeps that system healthy with **context-budget analysis**, **linting**, **governance checks**, **security scanning**, and **quick-fix refactors**.

## Why This Exists

Most teams fail in one of two ways:

- they put everything into one giant `CLAUDE.md`
- they keep adding rules forever and call it "learning"

That creates context bloat, contradictions, and instruction drift.

ClawdContext is built around the **Markdown OS thesis**:

> The problem is not Markdown.
> The problem is putting the wrong kind of instructions in the wrong Markdown file.

This extension operationalizes that thesis inside VS Code.

## Features

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

Shipped code actions:

- extract procedure from `CLAUDE.md` → `skills/<name>/SKILL.md`
- move temporal heuristic from kernel → `lessons.md`
- add missing governance metadata
- mark stale lesson as deprecated / promotion candidate
- archive deprecated entries
- add missing `SKILL.md` frontmatter
- open kernel bloat analysis
- prune when `KESSLER_RISK` triggers

## The Markdown OS Model (What Goes Where)

### AI-Powered Agent Management (Optional)

ClawdContext optionally integrates with AI providers for deeper analysis and automation.
AI features require a configured provider but gracefully degrade when none is set.

**Supported Providers:**
- **OpenAI** — GPT-4o, GPT-4o-mini, o1, o3, etc.
- **Anthropic** — Claude Sonnet 4, Claude Haiku, etc.
- **Azure OpenAI** — Enterprise GPT deployments with Entra ID / mTLS
- **Ollama** — Local models (Llama 3, Mistral, CodeLlama, etc.)
- **DeepSeek** — DeepSeek-V3, DeepSeek-Coder, etc.

**AI Capabilities:**
- Validate agent files with quality gates and fix suggestions
- Detect semantic contradictions across kernel, skills, and lessons
- Generate missing agent files from project context analysis
- Explain diagnostics with context-aware reasoning
- Suggest refactors (kernel → skills extraction, lessons promotion)
- Deep security review beyond regex pattern matching

**Enterprise Features:**
- mTLS client certificates (PFX/P12 or PEM cert + key)
- Custom CA certificates for corporate proxies
- Azure OpenAI with custom deployments and base URLs

**Security:**
- All AI-generated file paths are validated with `sanitizePath()` before writing
- Path traversal attacks (`../`, absolute paths) are blocked
- Only `.md` and `.json` files can be written
- User confirmation required before any file write

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

### VS Code Marketplace (Recommended)

```bash
code --install-extension clawdcontext.clawdcontext
```

Or search **"ClawdContext"** in the Extensions panel (`Ctrl+Shift+X` / `Cmd+Shift+X`).

### From VSIX (Local)

Download the latest `.vsix` from [GitHub Releases](https://github.com/yaamwebsolutions/clawdcontext4vscode/releases), then:

```bash
code --install-extension clawdcontext-<version>.vsix
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

### Core Commands

- `ClawdContext: Analyze Workspace` — Scan and analyze all agent markdown files
- `ClawdContext: Open Dashboard` — Interactive CER dashboard with health overview
- `ClawdContext: Lint .md Agent Files` — Run mdcc diagnostics
- `ClawdContext: Generate Context Health Report` — Export health report
- `ClawdContext: Prune Stale Lessons` — Review and deprecate stale lesson entries
- `ClawdContext: Review Promotion Candidates` — Identify lessons ready for kernel promotion
- `ClawdContext: Scaffold Markdown OS Templates` — Generate starter agent files
- `ClawdContext: Extract Procedure to SKILL.md` — Refactor procedure from kernel to skill
- `ClawdContext: Move Heuristic to lessons.md` — Move temporal heuristic from kernel
- `ClawdContext: Archive Deprecated Entries` — Clean up deprecated lessons
- `ClawdContext: Analyze Kernel Bloat` — Deep analysis of token-heavy kernel sections
- `ClawdContext: Compare CER with Previous Commit` — Git-based CER diff tracking
- `ClawdContext: Apply Config Preset` — Switch between strict/balanced/permissive profiles
- `ClawdContext: Export Dashboard` — Save dashboard as JSON or Markdown

### AI Commands (Optional — requires provider setup)

- `ClawdContext AI: Test Connection` — Verify AI provider connectivity
- `ClawdContext AI: Review Agent Config` — Get AI-powered optimization suggestions
- `ClawdContext AI: Explain Diagnostic` — Context-aware diagnostic explanations
- `ClawdContext AI: Suggest Refactor` — AI-recommended extraction and restructuring
- `ClawdContext AI: Security Review` — Deep semantic security analysis
- `ClawdContext AI: Validate Agent Files` — Full workspace validation with quality gates
- `ClawdContext AI: Validate This File` — Single-file AI validation
- `ClawdContext AI: Generate Missing Files` — Scaffold missing agent files from project context
- `ClawdContext AI: Generate / Regenerate File` — Generate specific agent file type
- `ClawdContext AI: Fix Violations` — Auto-fix diagnostics with safe path handling
- `ClawdContext AI: Detect Contradictions` — Find semantic contradictions across files

## Configuration

### Core Settings

| Setting | Default | Description |
|---|---|---|
| `clawdcontext.tokenBudget` | `200000` | Maximum context window tokens |
| `clawdcontext.cerWarningThreshold` | `0.4` | CER warning threshold |
| `clawdcontext.cerCriticalThreshold` | `0.2` | CER critical threshold |
| `clawdcontext.lessonsTtlDays` | `60` | Days before a lesson is considered stale |
| `clawdcontext.lessonsMaxEntries` | `50` | Max entries before Kessler risk triggers |
| `clawdcontext.alwaysLoadedFiles` | `[...]` | Glob patterns for always-loaded files |
| `clawdcontext.onDemandPatterns` | `[...]` | Glob patterns for on-demand files |
| `clawdcontext.enableCodeLens` | `true` | Show CodeLens badges on lessons |
| `clawdcontext.enableStatusBar` | `true` | Show CER status bar indicator |

### AI Settings (Optional)

| Setting | Default | Description |
|---|---|---|
| `clawdcontext.ai.provider` | `none` | AI provider: `none`, `openai`, `anthropic`, `azure-openai`, `ollama`, `deepseek` |
| `clawdcontext.ai.model` | `""` | Model name (e.g., `gpt-4o`, `claude-sonnet-4-20250514`, `llama3`) |
| `clawdcontext.ai.apiKey` | `""` | API key (stored in VS Code settings) |
| `clawdcontext.ai.baseUrl` | `""` | Custom base URL override (required for Azure OpenAI endpoint, optional for others) |
| `clawdcontext.ai.timeout` | `30000` | AI request timeout in milliseconds |
| `clawdcontext.ai.maxTokens` | `4000` | Max tokens for AI responses |
| `clawdcontext.ai.temperature` | `0.3` | Temperature for AI completions |
| `clawdcontext.ai.azureDeployment` | `""` | Azure OpenAI deployment name |
| `clawdcontext.ai.azureApiVersion` | `2024-12-01-preview` | Azure OpenAI API version |

### Enterprise mTLS Settings

| Setting | Default | Description |
|---|---|---|
| `clawdcontext.ai.pfxPath` | `""` | Path to PFX/P12 client certificate |
| `clawdcontext.ai.pfxPassphrase` | `""` | PFX passphrase |
| `clawdcontext.ai.certPath` | `""` | Path to PEM client certificate |
| `clawdcontext.ai.keyPath` | `""` | Path to PEM private key |
| `clawdcontext.ai.caCertPath` | `""` | Path to custom CA certificate |
| `clawdcontext.ai.rejectUnauthorized` | `true` | Verify TLS certificates (disable only for debugging) |

### Security Settings

| Setting | Default | Description |
|---|---|---|
| `clawdcontext.securityAllowlist` | `[]` | SEC_* rule codes to suppress |
| `clawdcontext.trustedDomains` | `[]` | Domains excluded from SEC_EXFIL_FETCH |
| `clawdcontext.securityCodeBlockAware` | `true` | Suppress findings inside fenced/inline code blocks |

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

## Development

```bash
git clone https://github.com/yaamwebsolutions/clawdcontext4vscode.git
cd clawdcontext4vscode
npm install
npm run compile
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes
4. Push to the branch
5. Open a Pull Request against `develop`

**Good First Issues:** [Filter by label](https://github.com/yaamwebsolutions/clawdcontext4vscode/labels/good%20first%20issue)

See also:

- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Community expectations
- [SECURITY.md](SECURITY.md) — Private vulnerability reporting
- [SUPPORT.md](SUPPORT.md) — Where to ask what
- [ROADMAP.md](ROADMAP.md) — Near-term priorities

## Star History

<a href="https://star-history.com/#yaamwebsolutions/clawdcontext4vscode&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=yaamwebsolutions/clawdcontext4vscode&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=yaamwebsolutions/clawdcontext4vscode&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=yaamwebsolutions/clawdcontext4vscode&type=Date" width="600" />
  </picture>
</a>

## License

[MIT](LICENSE) — see LICENSE for details.

---

**[Yaam Web Solutions](https://clawdcontext.com)**

[Install](https://marketplace.visualstudio.com/items?itemName=clawdcontext.clawdcontext) · [Report Issues](https://github.com/yaamwebsolutions/clawdcontext4vscode/issues) · [Discussions](https://github.com/yaamwebsolutions/clawdcontext4vscode/discussions)
