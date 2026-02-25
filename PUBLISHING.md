# Publishing Guide (VS Code Marketplace + Open VSX)

This repo is prepared for publishing the ClawdContext extension to:

- VS Code Marketplace
- Open VSX (for VSCodium and compatible editors)

## 1) One-Time Accounts and Tokens

### VS Code Marketplace (`vsce`)

1. Create / use your Azure DevOps publisher account
2. Ensure the publisher ID matches `package.json` (`clawdcontext`)
3. Create a Personal Access Token (PAT) with Marketplace publish permissions
4. Store it as repo secret: `VSCE_PAT`

### Open VSX (`ovsx`)

1. Create an Open VSX account
2. Create a namespace/publisher
3. Generate a token
4. Store it as repo secret: `OVSX_PAT`

## 2) Repo Metadata Before First Public Release

If the extension is moving to its own GitHub repo (recommended), update:

- `package.json` `repository.url`
- `package.json` `bugs.url`
- `package.json` `qna`
- README links/badges if needed

Recommended repo split:

- `clawdcontext.com` website repo (existing)
- `clawdcontext-vscode` extension repo (new)

## 3) Local Release Checklist

```bash
npm install
npm run check
npm run package
```

Verify:

- `.vsix` is created
- extension installs locally
- commands appear in VS Code
- dashboard opens
- diagnostics and code actions function on a sample workspace

## 4) CI and Release Workflows

This repo includes:

- `.github/workflows/ci.yml` — compile/lint/smoke/package validation
- `.github/workflows/release.yml` — tag-based GitHub release + optional marketplace publishing

### Tag Release Flow

1. Bump `package.json` version
2. Update `CHANGELOG.md`
3. Merge to `main`
4. Create and push tag matching the version, e.g. `v0.2.0`
5. GitHub Actions builds the `.vsix`, creates a GitHub Release, and publishes if secrets exist

## 5) Manual Publish Commands (Fallback)

```bash
npm run package
npx @vscode/vsce publish --packagePath ./clawdcontext-<version>.vsix -p <VSCE_PAT>
npx ovsx publish ./clawdcontext-<version>.vsix -p <OVSX_PAT>
```

## 6) Marketplace Readiness Tips (Top 1%)

- Keep `README.md` visually strong and technically specific
- Include a changelog for every release
- Publish screenshots/GIFs of CER dashboard and quick fixes
- Respond quickly to issues in first 30 days
- Ship small, frequent improvements after launch

## 7) Do Not Overclaim

ClawdContext improves governance, visibility, and safety reviews for agent Markdown systems.

It does not guarantee secure agent execution or eliminate prompt injection risk by itself.
