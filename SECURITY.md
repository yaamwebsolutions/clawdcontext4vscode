# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| `0.4.x` | Yes |
| `< 0.4.0` | No |

## Reporting a Vulnerability

Do **not** open a public GitHub issue for suspected security vulnerabilities.

Use one of these channels (in order of preference):

1. **GitHub Private Vulnerability Reporting** — go to the repository's **Security** tab → **"Report a vulnerability"**
2. **Email** — [security@clawdcontext.com](mailto:security@clawdcontext.com)

## What to Include

- affected version
- reproduction steps
- proof of impact
- logs/screenshots (if safe)
- proposed fix or mitigation (optional)

## Response Targets (Maintainer Goal)

- Acknowledge within `72 hours`
- Triage within `7 days`
- Remediation plan or mitigation guidance within `14 days`

## Scope Notes

ClawdContext includes static analysis and pattern-based security scanning for `SKILL.md`.

It does **not** provide:

- code execution sandboxing
- malware guarantees
- runtime isolation

Security findings in the extension are advisory detections and should be treated as review prompts, not definitive proof of safety.
