import * as fs from "node:fs";
import * as path from "node:path";

function assertExists(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file not found: ${filePath}`);
  }
}

function main(): void {
  const distExtension = path.resolve(__dirname, "..", "extension.js");
  const repoRoot = path.resolve(__dirname, "..", "..");
  const manifestPath = path.join(repoRoot, "package.json");

  assertExists(distExtension);
  assertExists(manifestPath);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
    name?: string;
    version?: string;
    contributes?: { commands?: unknown[] };
  };

  if (!manifest.name || !manifest.version) {
    throw new Error("package.json is missing required name/version");
  }

  if (!manifest.contributes?.commands || manifest.contributes.commands.length === 0) {
    throw new Error("package.json should declare at least one command");
  }

  process.stdout.write(
    `ClawdContext smoke test passed (${manifest.name}@${manifest.version}).\n`,
  );
}

main();
