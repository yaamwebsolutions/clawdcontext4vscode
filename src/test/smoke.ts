import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { sanitizePath } from "../ai/pathSafety";
import { classifyCerStatus } from "../analyzers/cerThresholds";

// ─── Helpers ────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assertExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file not found: ${filePath}`);
  }
}

function suite(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    process.stdout.write(`  ✓ ${name}\n`);
  } catch (err) {
    failed++;
    process.stderr.write(`  ✗ ${name}: ${(err as Error).message}\n`);
  }
}

// ─── Unit: sanitizePath ─────────────────────────────────────────────

function runSanitizePathTests(): void {
  suite("allows top-level agent files", () => {
    assert.equal(sanitizePath("CLAUDE.md"), "CLAUDE.md");
    assert.equal(sanitizePath("todo.md"), "todo.md");
    assert.equal(sanitizePath("lessons.md"), "lessons.md");
    assert.equal(sanitizePath("AGENTS.md"), "AGENTS.md");
    assert.equal(sanitizePath("plan.md"), "plan.md");
    assert.equal(sanitizePath("decisions.md"), "decisions.md");
    assert.equal(sanitizePath("lessons.archive.md"), "lessons.archive.md");
    assert.equal(sanitizePath("lessons-learned.md"), "lessons-learned.md");
    assert.equal(sanitizePath("learnings.md"), "learnings.md");
  });

  suite("allows nested agent paths", () => {
    assert.equal(sanitizePath("skills/example/SKILL.md"), "skills/example/SKILL.md");
    assert.equal(sanitizePath("./skills/example/SKILL.md"), "skills/example/SKILL.md");
    assert.equal(sanitizePath("agents/reviewer.md"), "agents/reviewer.md");
    assert.equal(sanitizePath("subagents/triage.md"), "subagents/triage.md");
    assert.equal(sanitizePath(".claude/settings.json"), ".claude/settings.json");
    assert.equal(sanitizePath(".claude/commands/fix.md"), ".claude/commands/fix.md");
  });

  suite("normalises backslash separators", () => {
    assert.equal(sanitizePath("subagents\\triage.md"), "subagents/triage.md");
    assert.equal(sanitizePath("skills\\deploy\\SKILL.md"), "skills/deploy/SKILL.md");
  });

  suite("rejects non-agent top-level files", () => {
    assert.equal(sanitizePath("README.md"), null);
    assert.equal(sanitizePath("CONTRIBUTING.md"), null);
    assert.equal(sanitizePath("package.json"), null);
    assert.equal(sanitizePath("tsconfig.json"), null);
  });

  suite("rejects non-agent nested paths", () => {
    assert.equal(sanitizePath(".vscode/settings.json"), null);
    assert.equal(sanitizePath("src/index.ts"), null);
    assert.equal(sanitizePath("docs/guide.md"), null);
    assert.equal(sanitizePath("lib/utils.md"), null);
  });

  suite("rejects path traversal", () => {
    assert.equal(sanitizePath("../CLAUDE.md"), null);
    assert.equal(sanitizePath("skills/../../etc/passwd"), null);
    assert.equal(sanitizePath("skills/../../../CLAUDE.md"), null);
  });

  suite("rejects absolute paths", () => {
    assert.equal(sanitizePath("/tmp/evil.md"), null);
    assert.equal(sanitizePath("/etc/passwd"), null);
    assert.equal(sanitizePath("C:\\temp\\evil.md"), null);
    assert.equal(sanitizePath("D:\\evil.md"), null);
  });

  suite("rejects non-md/json extensions", () => {
    assert.equal(sanitizePath("skills/example/run.sh"), null);
    assert.equal(sanitizePath("skills/example/payload.js"), null);
    assert.equal(sanitizePath("agents/evil.py"), null);
    assert.equal(sanitizePath(".claude/config.yaml"), null);
  });

  suite("rejects empty and control chars", () => {
    assert.equal(sanitizePath(""), null);
    assert.equal(sanitizePath("   "), null);
    assert.equal(sanitizePath("skills/\u0001bad/SKILL.md"), null);
    assert.equal(sanitizePath("skills/\u0000evil/SKILL.md"), null);
  });

  suite("rejects JSON in non-.claude nested dirs", () => {
    assert.equal(sanitizePath("skills/example/config.json"), null);
    assert.equal(sanitizePath("agents/config.json"), null);
  });
}

// ─── Unit: CER threshold classification ─────────────────────────────

function runCerThresholdClassificationTests(): void {
  suite("default thresholds (0.4 warn, 0.2 crit)", () => {
    assert.equal(classifyCerStatus(0.7, 0.4, 0.2), "optimal");
    assert.equal(classifyCerStatus(0.41, 0.4, 0.2), "optimal");
    assert.equal(classifyCerStatus(0.39, 0.4, 0.2), "warning");
    assert.equal(classifyCerStatus(0.21, 0.4, 0.2), "warning");
    assert.equal(classifyCerStatus(0.19, 0.4, 0.2), "critical");
    assert.equal(classifyCerStatus(0.0, 0.4, 0.2), "critical");
  });

  suite("boundary: equality stays in higher bucket", () => {
    assert.equal(classifyCerStatus(0.4, 0.4, 0.2), "optimal");
    assert.equal(classifyCerStatus(0.2, 0.4, 0.2), "warning");
  });

  suite("custom preset thresholds", () => {
    // Strict: warn=0.5, crit=0.3
    assert.equal(classifyCerStatus(0.5, 0.5, 0.3), "optimal");
    assert.equal(classifyCerStatus(0.45, 0.5, 0.3), "warning");
    assert.equal(classifyCerStatus(0.29, 0.5, 0.3), "critical");

    // Permissive: warn=0.3, crit=0.15
    assert.equal(classifyCerStatus(0.31, 0.3, 0.15), "optimal");
    assert.equal(classifyCerStatus(0.25, 0.3, 0.15), "warning");
    assert.equal(classifyCerStatus(0.1, 0.3, 0.15), "critical");
  });

  suite("edge: cer=1.0 and cer<0", () => {
    assert.equal(classifyCerStatus(1.0, 0.4, 0.2), "optimal");
    assert.equal(classifyCerStatus(-0.1, 0.4, 0.2), "critical");
  });
}

// ─── Integration: command registration parity ───────────────────────

function runCommandRegistrationTests(manifest: ManifestType): void {
  suite("extension.ts registers every manifest command", () => {
    const extensionSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "..", "src", "extension.ts"),
      "utf8",
    );

    const manifestCommands = (manifest.contributes?.commands ?? []).map(
      (c: { command: string }) => c.command,
    );

    assert.ok(manifestCommands.length >= 25, `Expected ≥25 commands, got ${manifestCommands.length}`);

    const missing: string[] = [];
    for (const cmd of manifestCommands) {
      // Check that extension.ts contains registerCommand('cmd') or registerCommand("cmd")
      if (!extensionSrc.includes(`'${cmd}'`) && !extensionSrc.includes(`"${cmd}"`)) {
        missing.push(cmd);
      }
    }

    assert.equal(
      missing.length,
      0,
      `Commands declared in package.json but not registered in extension.ts:\n  ${missing.join("\n  ")}`,
    );
  });

  suite("no orphan registrations (extension.ts commands exist in manifest)", () => {
    const extensionSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "..", "src", "extension.ts"),
      "utf8",
    );

    const manifestCommands = new Set(
      (manifest.contributes?.commands ?? []).map((c: { command: string }) => c.command),
    );

    // Also include non-contributed commands that are valid (e.g. refreshTree is contributed)
    const registerRe = /registerCommand\(\s*['"]([^'"]+)['"]/g;
    let match: RegExpExecArray | null;
    const orphans: string[] = [];
    while ((match = registerRe.exec(extensionSrc)) !== null) {
      const cmd = match[1];
      if (!manifestCommands.has(cmd)) {
        orphans.push(cmd);
      }
    }

    assert.equal(
      orphans.length,
      0,
      `Commands registered in extension.ts but not declared in package.json:\n  ${orphans.join("\n  ")}`,
    );
  });
}

// ─── Integration: compiled output completeness ──────────────────────

function runCompiledOutputTests(): void {
  suite("all expected dist modules exist", () => {
    const distRoot = path.resolve(__dirname, "..");
    const expectedModules = [
      "extension.js",
      "ai/provider.js",
      "ai/aiValidator.js",
      "ai/aiGenerator.js",
      "ai/commands.js",
      "ai/prompts.js",
      "ai/pathSafety.js",
      "ai/index.js",
      "analyzers/tokenAnalyzer.js",
      "analyzers/diagnosticsProvider.js",
      "analyzers/securityScanner.js",
      "analyzers/cerThresholds.js",
      "providers/codeActionProvider.js",
      "providers/treeProvider.js",
      "providers/codeLensProvider.js",
      "providers/statusBar.js",
      "commands/analyzeWorkspace.js",
      "commands/showDashboard.js",
      "commands/cerDiffTracking.js",
      "commands/configPresets.js",
      "commands/dashboardExport.js",
      "commands/lessonsCommands.js",
      "commands/generateReport.js",
      "utils/scaffold.js",
    ];

    const missing: string[] = [];
    for (const mod of expectedModules) {
      if (!fs.existsSync(path.join(distRoot, mod))) {
        missing.push(mod);
      }
    }

    assert.equal(
      missing.length,
      0,
      `Expected dist modules not found:\n  ${missing.join("\n  ")}`,
    );
  });
}

// ─── Integration: security patterns coverage ────────────────────────

function runSecurityPatternTests(): void {
  suite("security scanner has ≥17 pattern categories", () => {
    const scannerSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "..", "src", "analyzers", "securityScanner.ts"),
      "utf8",
    );

    // Count unique SEC_ pattern IDs
    const idMatches = scannerSrc.match(/id:\s*'SEC_\w+'/g) ?? [];
    const uniqueIds = new Set(idMatches.map(m => m.match(/'(SEC_\w+)'/)?.[1]));

    assert.ok(
      uniqueIds.size >= 17,
      `Expected ≥17 SEC_ pattern categories, found ${uniqueIds.size}: ${[...uniqueIds].join(", ")}`,
    );
  });
}

// ─── Integration: AI module exports ─────────────────────────────────

function runAiExportTests(): void {
  suite("AI barrel module exports all expected symbols", () => {
    const barrelSrc = fs.readFileSync(
      path.resolve(__dirname, "..", "..", "src", "ai", "index.ts"),
      "utf8",
    );

    const expectedExports = [
      "aiComplete", "testAiConnection", "isAiEnabled", "getAiConfig", "getProviderLabel",
      "SYSTEM_PROMPT_ANALYST", "SYSTEM_PROMPT_VALIDATOR", "SYSTEM_PROMPT_GENERATOR",
      "SYSTEM_PROMPT_FIXER", "SYSTEM_PROMPT_CONTRADICTION",
      "validateFile", "validateWorkspace", "detectContradictions", "fixFile", "computeQualityGate",
      "generateMissing", "generateFile", "fixFileFromViolations",
      "aiTestConnection", "aiReviewConfig", "aiExplainDiagnostic", "aiSuggestRefactor",
      "aiSecurityReview", "aiValidateWorkspace", "aiValidateFile",
      "aiGenerateMissing", "aiGenerateFile", "aiFixCurrentFile", "aiDetectContradictions",
    ];

    const missing: string[] = [];
    for (const sym of expectedExports) {
      if (!barrelSrc.includes(sym)) {
        missing.push(sym);
      }
    }

    assert.equal(
      missing.length,
      0,
      `AI barrel missing exports:\n  ${missing.join("\n  ")}`,
    );
  });
}

// ─── Integration: .vscodeignore excludes dev files ──────────────────

function runPackagingTests(): void {
  suite(".vscodeignore excludes src, .github, docs", () => {
    const ignorePath = path.resolve(__dirname, "..", "..", ".vscodeignore");
    const ignoreContent = fs.readFileSync(ignorePath, "utf8");

    const requiredExcludes = ["src/**", ".github/**", "node_modules/**", "*.vsix"];
    const missing: string[] = [];
    for (const pattern of requiredExcludes) {
      if (!ignoreContent.includes(pattern)) {
        missing.push(pattern);
      }
    }

    assert.equal(
      missing.length,
      0,
      `.vscodeignore missing required exclusions:\n  ${missing.join("\n  ")}`,
    );
  });

  suite(".vscodeignore includes dist output", () => {
    const ignorePath = path.resolve(__dirname, "..", "..", ".vscodeignore");
    const ignoreContent = fs.readFileSync(ignorePath, "utf8");

    assert.ok(
      ignoreContent.includes("!dist/**"),
      ".vscodeignore must include !dist/** to ship compiled output",
    );
  });
}

// ─── Main ───────────────────────────────────────────────────────────

type ManifestType = {
  name?: string;
  version?: string;
  contributes?: { commands?: Array<{ command: string }> };
};

function main(): void {
  const distExtension = path.resolve(__dirname, "..", "extension.js");
  const repoRoot = path.resolve(__dirname, "..", "..");
  const manifestPath = path.join(repoRoot, "package.json");

  assertExists(distExtension);
  assertExists(manifestPath);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ManifestType;

  if (!manifest.name || !manifest.version) {
    throw new Error("package.json is missing required name/version");
  }

  if (!manifest.contributes?.commands || manifest.contributes.commands.length === 0) {
    throw new Error("package.json should declare at least one command");
  }

  process.stdout.write(`\nClawdContext Test Suite (${manifest.name}@${manifest.version})\n`);
  process.stdout.write("─".repeat(50) + "\n");

  // Unit tests
  process.stdout.write("\n[Unit] sanitizePath\n");
  runSanitizePathTests();

  process.stdout.write("\n[Unit] CER threshold classification\n");
  runCerThresholdClassificationTests();

  // Integration tests
  process.stdout.write("\n[Integration] Command registration parity\n");
  runCommandRegistrationTests(manifest);

  process.stdout.write("\n[Integration] Compiled output completeness\n");
  runCompiledOutputTests();

  process.stdout.write("\n[Integration] Security scanner patterns\n");
  runSecurityPatternTests();

  process.stdout.write("\n[Integration] AI module exports\n");
  runAiExportTests();

  process.stdout.write("\n[Integration] Packaging\n");
  runPackagingTests();

  // Summary
  process.stdout.write("\n" + "─".repeat(50) + "\n");
  if (failed > 0) {
    process.stderr.write(`FAILED: ${failed} suite(s) failed, ${passed} passed.\n`);
    process.exit(1);
  }
  process.stdout.write(`ALL PASSED: ${passed} suites.\n\n`);
}

main();
