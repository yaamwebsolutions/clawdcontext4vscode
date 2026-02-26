/**
 * Sanitize an AI-generated file path to prevent workspace-escape writes.
 * Rejects absolute paths, path traversal (../), and writes outside known agent paths.
 * Returns the sanitized relative path, or null if unsafe.
 */
export function sanitizePath(raw: string): string | null {
  // Normalise separators and trim
  let p = raw.trim().replace(/\\/g, '/');
  if (!p) { return null; }

  // Reject absolute paths
  if (p.startsWith('/') || /^[A-Za-z]:/.test(p)) { return null; }

  // Resolve and reject traversal
  const segments = p.split('/').filter(Boolean);
  const resolved: string[] = [];
  for (const seg of segments) {
    if (hasControlChars(seg)) { return null; }
    if (seg === '..') { return null; }
    if (seg !== '.') { resolved.push(seg); }
  }
  if (resolved.length === 0) { return null; }

  p = resolved.join('/');
  const lower = p.toLowerCase();

  const isMarkdown = lower.endsWith('.md');
  const isJson = lower.endsWith('.json');
  if (!isMarkdown && !isJson) { return null; }

  // Top-level core agent files only
  const topLevel = pathPosixBasename(lower) === lower;
  if (topLevel) {
    return TOP_LEVEL_AGENT_FILES.has(lower) ? p : null;
  }

  // Nested agent paths only
  if (lower.startsWith('.claude/')) {
    // Allow markdown and JSON config within .claude/
    return (isMarkdown || isJson) ? p : null;
  }
  if (lower.startsWith('skills/') || lower.startsWith('agents/') || lower.startsWith('subagents/')) {
    return isMarkdown ? p : null;
  }

  return null;
}

const TOP_LEVEL_AGENT_FILES = new Set([
  'claude.md',
  'agents.md',
  'skill.md',
  'todo.md',
  'plan.md',
  'lessons.md',
  'lessons.archive.md',
  'lessons-learned.md',
  'learnings.md',
  'decisions.md',
]);

function pathPosixBasename(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    if (value.charCodeAt(i) < 32) { return true; }
  }
  return false;
}
