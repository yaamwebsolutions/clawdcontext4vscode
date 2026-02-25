# Roadmap

ClawdContext is already useful in production workflows, but the goal is a category-defining VS Code extension for AI coding agent Markdown systems.

## Current Focus (0.2.x)

- Stabilize diagnostics and reduce false positives
- Improve code action reliability on real-world markdown variants
- Harden packaging/release automation (Marketplace + Open VSX)
- Improve onboarding (examples, screenshots, demo GIFs)

## Next (0.3.x)

- Accurate tokenizer integration (BPE-backed counts)
- Better contradiction detection (semantic/structured rules)
- Richer `SKILL.md` security scanner rules + tuning
- More dashboard exports (JSON/Markdown report artifacts)
- Workspace-level config presets (strict / balanced / permissive)

## Next (0.4.x)

- "What changed CER?" diff tracking between commits
- Positional heatmap improvements and reordering suggestions
- Rule suppression/waiver UX with audit trail
- Performance tuning for large monorepos
- Sample repos for common agent stacks (Claude Code, OpenClaw-style, hybrid)

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
