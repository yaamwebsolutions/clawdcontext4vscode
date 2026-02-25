import * as vscode from 'vscode';
import * as path from 'path';

const TEMPLATES: Record<string, string> = {
  'CLAUDE.md': `# Project Instructions

## Architecture Invariants
- Preserve module boundaries
- No direct DB access from presentation layer
- Keep public API backward compatible unless explicitly planned

## Preferred Workflow
1. Plan first (\`todo.md\`)
2. Implement minimal diff
3. Verify with tests/logs
4. Capture lessons only after confirmed fix

## Commands
- Test: \`pnpm test\`
- Lint: \`pnpm lint\`
- Typecheck: \`pnpm typecheck\`

## Review Checklist
- Does it solve the root cause?
- Is there a simpler solution?
- What is the blast radius?
- Would a staff engineer approve this?
`,

  'todo.md': `# Task Plan

## Objective
- [ ] Define the exact outcome

## Constraints
- [ ] No breaking changes
- [ ] Preserve architecture invariants
- [ ] Tests must pass

## Plan
- [ ] 1. Inspect current behavior
- [ ] 2. Propose minimal change
- [ ] 3. Implement
- [ ] 4. Verify (tests/logs/manual)
- [ ] 5. Document impact

## Definition of Done
- [ ] Feature works
- [ ] No regression
- [ ] Diff reviewed
- [ ] Lessons captured (if applicable)
`,

  'lessons.md': `# Lessons Learned

<!-- ClawdContext governance metadata:
  Each entry MUST include: date, scope, type, confidence, source, status
  Types: local-heuristic | global-invariant | process | tooling
  Confidence: low | med | high
  Status: proposed | approved | deprecated
  Promotion candidate: yes | no
  TTL for local-heuristic: 60 days (configurable in clawdcontext settings)
-->

<!-- Add your first lesson below this line -->
`,

  'AGENTS.md': `# Agent Roles

## Planner
- Break work into checkable steps
- Identify risks/dependencies
- Write/refresh \`todo.md\` first

## Builder
- Implement minimal change
- Respect \`CLAUDE.md\`
- Do not mark done without evidence

## Reviewer
- Validate invariants
- Check blast radius
- Reject "works locally" without proof

## Tester
- Run relevant tests
- Capture failing logs
- Suggest regression coverage

## Scribe
- Update \`lessons.md\` only after confirmed correction
- Tag lessons as local/global/deprecated
`,
};

const SKILL_TEMPLATE = `---
name: <skill-name>
description: <what this skill enables the agent to do>
---

# <Skill Name>

## Goal
<Describe the specific outcome this skill achieves.>

## Steps
1. <Gather context — read relevant files and understand current state>
2. <Execute — apply the change, fix, or generation>
3. <Validate — run tests, lint, or build to confirm correctness>

## Output Format
- Summary of what was done
- Evidence (logs, test results, build output)
- Residual risk or follow-up items
`;

export async function scaffoldMarkdownOS(): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage('No workspace folder open.');
    return;
  }

  const rootUri = workspaceFolders[0].uri;

  // Ask user which files to create
  const picks = await vscode.window.showQuickPick(
    [
      { label: 'CLAUDE.md', description: 'Kernel — global invariants', picked: true },
      { label: 'todo.md', description: 'Task state — checkable planning', picked: true },
      { label: 'lessons.md', description: 'Post-correction learning (governed)', picked: true },
      { label: 'AGENTS.md', description: 'Agent role definitions (community pattern)', picked: false },
      { label: 'skills/example/SKILL.md', description: 'Example SKILL.md with frontmatter', picked: false },
    ],
    {
      canPickMany: true,
      title: 'ClawdContext: Scaffold Markdown OS',
      placeHolder: 'Select files to create',
    }
  );

  if (!picks || picks.length === 0) { return; }

  let created = 0;
  for (const pick of picks) {
    const filePath = pick.label;
    const fileUri = vscode.Uri.joinPath(rootUri, filePath);

    // Check if file exists
    try {
      await vscode.workspace.fs.stat(fileUri);
      const overwrite = await vscode.window.showWarningMessage(
        `${filePath} already exists. Overwrite?`,
        'Yes', 'No'
      );
      if (overwrite !== 'Yes') { continue; }
    } catch {
      // File doesn't exist, good
    }

    // Create directories if needed
    const dirUri = vscode.Uri.joinPath(rootUri, path.dirname(filePath));
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch {
      // Directory may already exist
    }

    // Write file
    const content = filePath.includes('SKILL.md') ? SKILL_TEMPLATE : TEMPLATES[filePath] || '';
    await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
    created++;
  }

  vscode.window.showInformationMessage(
    `ClawdContext: Created ${created} Markdown OS files. Run "Analyze Workspace" to see your context health.`
  );
}
