/**
 * Skill Forge Studio — Offline Templates.
 *
 * Extracted from the original skillForge.ts SKILL_TEMPLATES.
 * Used as fallback when the SFS backend is unreachable.
 * Produces a SfsGenerateResponse-compatible output purely from templates.
 */

import type { SfsSkillConfig, SfsGenerateResponse, SfsGeneratedFile } from './sfsClient';

// ─── Archetype → SFS ID mapping ────────────────────────────
// The original extension used letters (A-G); SFS uses A1-A7.
const ARCHETYPE_ID_MAP: Record<string, string> = {
  A1: 'A', A2: 'B', A3: 'C', A4: 'D', A5: 'E', A6: 'F', A7: 'G',
  // Also support legacy IDs directly
  A: 'A', B: 'B', C: 'C', D: 'D', E: 'E', F: 'F', G: 'G',
};

// ─── SKILL.md templates (one per archetype) ─────────────────

const SKILL_TEMPLATES: Record<string, string> = {
  A: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Core Philosophy

{{philosophy}}

## Anti-Patterns — What to NEVER Do

- **TODO**: Describe anti-pattern

## Examples

### Good
TODO: Good example

### Bad
TODO: Bad example
`,

  B: `---
name: {{name}}
description: "{{description}}. Trigger when user mentions {{triggers}}."
---

# {{title}}

Route to the appropriate template based on user intent:

| Intent | Template |
|--------|----------|
{{template_table}}

## Routing Rules

1. Ask the user what type of output they need
2. Load the matching template
3. Fill in the template using the user's input

## Default Behavior

If the user's intent is unclear, ask a clarifying question.
`,

  C: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{description}}

## Framework Router

| Framework / Domain | Reference |
|--------------------|-----------|
{{reference_table}}

## Workflow

1. Identify the user's framework/domain
2. Load the matching reference doc
3. Apply framework-specific patterns
4. Validate output against reference
`,

  D: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{description}}

## Available Scripts

| Script | Purpose |
|--------|---------|
{{script_table}}

## Workflow

1. Understand the user's file/data requirements
2. Select the appropriate script
3. Run with the user's parameters
4. Validate the output
`,

  E: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Phase 1 — Philosophy

{{description}}

### Core Principles
- TODO: Define principle 1
- TODO: Define principle 2

### Aesthetic Direction
TODO: Define aesthetic direction

## Phase 2 — Expression

Generate the artifact following the philosophy above.

### Technical Requirements
- TODO: Define technical requirement 1
- TODO: Define technical requirement 2
`,

  F: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{description}}

## Scaffolding Pipeline

### Step 1: Initialize
Run \`scripts/init.sh\` to create the project structure.

### Step 2: Configure
Apply user preferences to the generated scaffold.

### Step 3: Build & Bundle
Run \`scripts/build.sh\` to bundle the final output.

## Generated Structure

\`\`\`
TODO: Define project structure
\`\`\`
`,

  G: `---
name: {{name}}
description: "{{description}}. Use when {{triggers}}."
---

# {{title}}

## Overview

{{description}}

## Architecture

### References
| Topic | File |
|-------|------|
{{reference_table}}

### Scripts
| Script | Purpose |
|--------|---------|
{{script_table}}

### Subagents
| Agent | Role |
|-------|------|
{{agent_table}}

## Lifecycle

1. **Intake** — Classify user request
2. **Plan** — Break into steps
3. **Generate** — Create all artifacts
4. **Validate** — Run quality checks
5. **Export** — Package for delivery
`,
};

// ─── Generator ──────────────────────────────────────────────

/**
 * Generate skill files from local templates (no SFS backend needed).
 * Produces a SfsGenerateResponse compatible with the webview.
 */
export function generateOfflineSkill(config: SfsSkillConfig): SfsGenerateResponse {
  const archLetter = ARCHETYPE_ID_MAP[config.archetype] || 'A';
  const template = SKILL_TEMPLATES[archLetter] || SKILL_TEMPLATES['A'];
  const title = config.name.split('-').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  const triggers = config.positive_keywords.length
    ? config.positive_keywords.join(', ')
    : 'TODO: add trigger phrases';

  // Build dynamic table rows
  const templateTable = (config.template_names.length ? config.template_names : ['example'])
    .map(t => `| ${t} | examples/${slug(t)}.md |`).join('\n');
  const referenceTable = (config.variant_names.length ? config.variant_names : ['default'])
    .map(v => `| ${v} | references/${slug(v)}.md |`).join('\n');
  const scriptExt = { python: 'py', javascript: 'js', shell: 'sh' }[config.script_language] || 'py';
  const scriptTable = (config.operations.length ? config.operations : ['main'])
    .map(op => `| scripts/${slug(op)}.${scriptExt} | ${op} |`).join('\n');
  const agentTable = (config.subagents.length ? config.subagents : [])
    .map(ag => `| agents/${slug(ag)}.md | ${ag} |`).join('\n') || '| agents/TODO.md | TODO |';

  // Fill template
  let filled = template
    .replace(/\{\{name\}\}/g, config.name)
    .replace(/\{\{title\}\}/g, title)
    .replace(/\{\{description\}\}/g, config.description || 'TODO: describe this skill')
    .replace(/\{\{triggers\}\}/g, triggers)
    .replace(/\{\{philosophy\}\}/g, config.description || 'TODO: core philosophy')
    .replace(/\{\{template_table\}\}/g, templateTable)
    .replace(/\{\{reference_table\}\}/g, referenceTable)
    .replace(/\{\{script_table\}\}/g, scriptTable)
    .replace(/\{\{agent_table\}\}/g, agentTable);

  // Add trigger section at end
  filled += buildTriggerSection(config);

  const files: SfsGeneratedFile[] = [];

  // SKILL.md (always)
  files.push({
    path: 'SKILL.md',
    content: filled,
    language: 'markdown',
    estimated_lines: filled.split('\n').length,
  });

  // Subdirectory files based on archetype
  if (archLetter === 'B') {
    const names = config.template_names.length ? config.template_names : ['example'];
    for (const name of names) {
      files.push(makeStubFile(`examples/${slug(name)}.md`, 'markdown',
        `# ${name}\n\nTODO: Template content for "${name}"\n`));
    }
    if (config.has_catch_all) {
      files.push(makeStubFile('examples/catch-all.md', 'markdown',
        '# Catch-All\n\nDefault template when no specific match.\n'));
    }
  }

  if (archLetter === 'C' || archLetter === 'G') {
    const variants = config.variant_names.length ? config.variant_names : ['default'];
    for (const v of variants) {
      files.push(makeStubFile(`references/${slug(v)}.md`, 'markdown',
        `# ${v} Reference\n\nTODO: Reference documentation for "${v}"\n`));
    }
  }

  if (archLetter === 'D' || archLetter === 'F' || archLetter === 'G') {
    const ops = config.operations.length ? config.operations : ['main'];
    for (const op of ops) {
      files.push(makeStubFile(
        `scripts/${slug(op)}.${scriptExt}`,
        scriptLanguageId(config.script_language),
        makeScriptStub(op, config.script_language),
      ));
    }
    if (archLetter === 'F') {
      files.push(makeStubFile('scripts/init.sh', 'shellscript',
        '#!/bin/bash\n# Initialize scaffold\necho "TODO: scaffold init"\n'));
      files.push(makeStubFile('scripts/bundle.sh', 'shellscript',
        '#!/bin/bash\n# Build and bundle\necho "TODO: build + bundle"\n'));
    }
    if (config.has_shared_utils) {
      files.push(makeStubFile(
        `scripts/utils.${scriptExt}`,
        scriptLanguageId(config.script_language),
        `# Shared utilities\n# TODO: Add shared helper functions\n`,
      ));
    }
  }

  if (archLetter === 'G') {
    const agents = config.subagents.length ? config.subagents : [];
    for (const ag of agents) {
      files.push(makeStubFile(`agents/${slug(ag)}.md`, 'markdown',
        `# ${ag} Agent\n\nTODO: Define ${ag} agent role and responsibilities\n`));
    }
  }

  if (config.has_eval_harness || archLetter === 'G') {
    files.push(makeStubFile('evals/evals.json', 'json',
      JSON.stringify(buildEvalsJson(config, title), null, 2)));
    files.push(makeStubFile('evals/quality-rubric.md', 'markdown',
      buildQualityRubric(config, title)));
  }

  // README
  files.push(makeStubFile('README.md', 'markdown',
    `# ${title}\n\n${config.description || 'TODO'}\n\n## Archetype\n\n${config.archetype}\n`));

  const totalLines = files.reduce((sum, f) => sum + f.estimated_lines, 0);

  return {
    files,
    token_budget_used: Math.round(totalLines * 4),
    validation_warnings: [],
    ai_powered: false,
    degraded: false,
    provider_used: null,
    model_used: null,
  };
}

// ─── Utilities ──────────────────────────────────────────────

function slug(s: string): string {
  return s.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

function makeStubFile(path: string, language: string, content: string): SfsGeneratedFile {
  return { path, content, language, estimated_lines: content.split('\n').length };
}

function scriptLanguageId(lang: string): string {
  return { python: 'python', javascript: 'javascript', shell: 'shellscript' }[lang] || 'plaintext';
}

function makeScriptStub(operation: string, lang: string): string {
  switch (lang) {
    case 'python':
      return `#!/usr/bin/env python3\n"""${operation} — TODO: implement"""\n\ndef main():\n    raise NotImplementedError("${operation}")\n\nif __name__ == "__main__":\n    main()\n`;
    case 'javascript':
      return `#!/usr/bin/env node\n/** ${operation} — TODO: implement */\n\nfunction main() {\n  throw new Error("${operation}: not implemented");\n}\n\nmain();\n`;
    case 'shell':
      return `#!/bin/bash\n# ${operation} — TODO: implement\nset -euo pipefail\n\necho "TODO: implement ${operation}"\n`;
    default:
      return `# ${operation}\n# TODO: implement\n`;
  }
}

/**
 * Build Agent Skills 2.0 evals.json from config data.
 * Format: https://agentskills.io/llms.txt
 */
function buildEvalsJson(config: SfsSkillConfig, title: string): Record<string, unknown> {
  const evals: Array<Record<string, unknown>> = [];
  const keywords = config.positive_keywords.length ? config.positive_keywords : [];
  const desc = config.description || title;

  // Generate 2-3 eval cases from trigger keywords + description
  if (keywords.length > 0) {
    evals.push({
      id: 1,
      prompt: `I need help with ${keywords[0]}`,
      expected_output: `The skill handles the ${keywords[0]} request using ${desc} — produces complete, actionable output.`,
      assertions: [
        'Output is non-empty and directly addresses the request',
        `Output relates to ${keywords[0]}`,
        'No TODO or placeholder text in output',
      ],
    });
  }
  if (keywords.length > 1) {
    evals.push({
      id: 2,
      prompt: `Can you ${keywords[1]}? I need this done quickly.`,
      expected_output: `Completes the ${keywords[1]} task efficiently with clear results.`,
      assertions: [
        'Output is non-empty and directly addresses the request',
        `Output relates to ${keywords[1]}`,
        'Output includes actionable steps or concrete results',
      ],
    });
  }
  // Always add an edge-case eval
  evals.push({
    id: evals.length + 1,
    prompt: `Help me with something related to ${desc} but with minimal context`,
    expected_output: 'The skill either asks clarifying questions or produces reasonable default output.',
    assertions: [
      'Output does not hallucinate requirements not mentioned in the prompt',
      'Output either asks for clarification or provides a sensible default',
    ],
  });

  return {
    skill_name: config.name,
    description: `Evaluation suite for ${title}. Run each eval with and without the skill to measure value added.`,
    documentation: 'https://agentskills.io/skill-creation/evaluating-skills',
    evals,
  };
}

/**
 * Build a quality rubric grounded in the Agent Skills 2.0 eval methodology.
 */
function buildQualityRubric(config: SfsSkillConfig, title: string): string {
  return `# Quality Rubric — ${title}

` +
    `> Evaluation methodology: [Agent Skills 2.0](https://agentskills.io/skill-creation/evaluating-skills)\n\n` +
    `## How to Evaluate\n\n` +
    `1. Run each eval in \`evals/evals.json\` **with the skill** and **without the skill** (baseline)\n` +
    `2. Grade each assertion as PASS or FAIL with concrete evidence\n` +
    `3. Record results in \`grading.json\` per eval\n` +
    `4. Aggregate into \`benchmark.json\` and compare delta\n\n` +
    `## Scoring Criteria\n\n` +
    `| Criterion | Weight | Pass Threshold |\n` +
    `|---|---|---|\n` +
    `| Completeness | 25% | All required sections/outputs present |\n` +
    `| Accuracy | 25% | No factual errors, correct logic |\n` +
    `| Actionability | 20% | Output is directly usable, not vague |\n` +
    `| Format | 15% | Matches expected ${config.output_type || 'text'} output type |\n` +
    `| Skill Delta | 15% | Pass rate improves vs. no-skill baseline |\n\n` +
    `## Iteration Workflow\n\n` +
    `\`\`\`\n` +
    `evals/          → define test cases (evals.json)\n` +
    `iteration-1/    → first run results\n` +
    `  eval-*/       → per-test directories\n` +
    `    with_skill/    → outputs + grading.json + timing.json\n` +
    `    without_skill/ → baseline outputs + grading.json\n` +
    `  benchmark.json   → aggregated pass rates + delta\n` +
    `  feedback.json    → human review notes\n` +
    `\`\`\`\n\n` +
    `## Grading Template (grading.json)\n\n` +
    `\`\`\`json\n` +
    `{\n` +
    `  "assertion_results": [\n` +
    `    { "text": "...", "passed": true, "evidence": "Found X in output" }\n` +
    `  ],\n` +
    `  "summary": { "passed": 0, "failed": 0, "total": 0, "pass_rate": 0.0 }\n` +
    `}\n` +
    `\`\`\`\n`;
}

function buildTriggerSection(config: SfsSkillConfig): string {
  const lines: string[] = ['\n## Trigger Configuration\n'];

  lines.push(`Strategy: **${config.trigger_strategy}**`);
  lines.push(`Pushiness: ${config.pushiness}/100\n`);

  if (config.positive_keywords.length) {
    lines.push('### Positive Keywords');
    lines.push(config.positive_keywords.map(k => `- ${k}`).join('\n'));
    lines.push('');
  }
  if (config.negative_keywords.length) {
    lines.push('### Negative Keywords (suppress)');
    lines.push(config.negative_keywords.map(k => `- ${k}`).join('\n'));
    lines.push('');
  }

  return lines.join('\n');
}
