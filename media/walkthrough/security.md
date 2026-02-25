# Security Scanning

ClawdContext scans SKILL.md files for 21 threat patterns across 8 categories:

- **Prompt injection** — Role overrides, delimiter manipulation, encoded payloads
- **Credential exposure** — API keys, tokens, passwords in plain text
- **Data exfiltration** — HTTP fetches, DNS tunneling to external services
- **Code execution** — Shell commands, dynamic eval, system calls
- **Supply chain** — Untrusted npm/pip packages, suspicious registries
- **SSRF** — Internal network access, metadata endpoints
- **Path traversal** — Directory escape, sensitive file access
- **Privilege escalation** — sudo, chmod, admin grants

Configure allowlists and trusted domains to suppress known false positives.
