# Analyze Your Workspace

ClawdContext scans your project for Markdown OS files and calculates your **Context Efficiency Ratio (CER)**.

**What gets scanned:**
- `CLAUDE.md` — Kernel configuration (always loaded)
- `AGENTS.md` — Agent instructions (always loaded)
- `SKILL.md` — On-demand skills (lazy loaded)
- `lessons.md` — Learning cache
- `todo.md` — Task tracking
- `.clawdcontext/hooks/` — Interrupt hooks

**CER = useful tokens / total tokens** — target > 0.6
