# Roadmap

ClawdContext is already useful in production workflows, but the goal is a category-defining VS Code extension for AI coding agent Markdown systems.

## Shipped

### 0.2.x — Foundation

- ✅ Diagnostics, code actions, security scanner, scaffold templates
- ✅ Marketplace + Open VSX packaging automation
- ✅ Onboarding (demo screenshot, README badges, install CTA)

### 0.3.x — Modularization

- ✅ Command architecture extracted to `src/commands/`
- ✅ Multi-platform CI (Ubuntu / macOS / Windows × Node 20 / 22)
- ✅ Secret scanning workflow (gitleaks)
- ✅ Branch strategy (main + develop, protection rules)

## Current Focus (0.4.x)

- [x] CER diff tracking — "what changed CER?" comparison between git commits
- [x] Config presets — `strict` / `balanced` / `permissive` workspace profiles
- [x] Dashboard export — JSON + Markdown report artifacts
- [x] Richer `SKILL.md` security scanner patterns (supply-chain, SSRF, path traversal, privilege escalation)
- [x] Optional AI capabilities — OpenAI, Anthropic/Claude, Ollama with enterprise TLS support
- [x] Security scanner allowlist, trusted domains, code-block awareness
- [ ] BPE-backed tokenizer (replace character-ratio estimation with cl100k_base-calibrated counts)
- [ ] Positional heatmap improvements — drag-to-reorder suggestions

## Next (0.5.x)

- Rule suppression / waiver UX with inline `<!-- clawdcontext-ignore -->` and audit trail
- Performance tuning for large monorepos (incremental analysis, file-change debouncing)
- Sample repos for common agent stacks (Claude Code, Cursor, Windsurf, hybrid)
- Contradiction detection v2 (semantic rules beyond keyword matching)
- Multi-root workspace support

## Contributor-Friendly Areas

Good first issues:

- docs polish
- issue templates improvements
- sample markdown fixtures
- additional diagnostics with clear deterministic rules
- UI copy improvements (dashboard/status bar)

Higher-leverage contributions:

- tokenizer accuracy
- diagnostics architecture
- security scanner pattern design
- code action extraction/refactor UX

## North Star

Make ClawdContext the default observability + governance layer for agent Markdown workflows in VS Code.
