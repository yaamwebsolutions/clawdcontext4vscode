import * as vscode from 'vscode';
import type { AgentFile } from './tokenAnalyzer';

// ─── Security Severity ──────────────────────────────────────────────

export type SecuritySeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

export interface SecurityFinding {
  line: number;
  column: number;
  endColumn: number;
  severity: SecuritySeverity;
  code: string;
  message: string;
  detail: string;
  matchedText: string;
  suppressed?: boolean;       // true if in code block or allowlisted
  suppressReason?: string;    // why it was suppressed
}

export interface SecurityReport {
  file: AgentFile;
  findings: SecurityFinding[];
  suppressedCount: number;    // how many findings were suppressed
  score: number;              // 0–100, lower = more suspicious
  verdict: 'clean' | 'suspicious' | 'dangerous';
}

// ─── Configuration Helpers ──────────────────────────────────────────

interface SecurityConfig {
  allowlist: string[];        // SEC_* codes to suppress entirely
  trustedDomains: string[];   // domains allowed in URL patterns
  codeBlockAware: boolean;    // downgrade findings inside ``` blocks
}

function getSecurityConfig(): SecurityConfig {
  const cfg = vscode.workspace.getConfiguration('clawdcontext');
  return {
    allowlist: cfg.get<string[]>('securityAllowlist', []),
    trustedDomains: cfg.get<string[]>('trustedDomains', []),
    codeBlockAware: cfg.get<boolean>('securityCodeBlockAware', true),
  };
}

/**
 * Build a set of lines that are inside fenced code blocks (```).
 * Findings on these lines are documentation examples, not threats.
 */
function getCodeBlockLines(content: string): Set<number> {
  const lines = content.split('\n');
  const codeLines = new Set<number>();
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*```/.test(lines[i])) {
      if (inBlock) {
        // closing fence — this line is still in the block
        codeLines.add(i);
        inBlock = false;
      } else {
        inBlock = true;
        codeLines.add(i);
      }
    } else if (inBlock) {
      codeLines.add(i);
    }
  }
  return codeLines;
}

/**
 * Check if a character range falls inside an inline backtick span (` ... `).
 * This catches patterns like `npm run deploy` or `process.env.VAR` in prose.
 */
function isInsideInlineCode(line: string, matchStart: number, matchEnd: number): boolean {
  // Find all inline code spans (backtick pairs) in the line
  const backtickRe = /`([^`]+)`/g;
  let m: RegExpExecArray | null;
  while ((m = backtickRe.exec(line)) !== null) {
    const spanStart = m.index;
    const spanEnd = m.index + m[0].length;
    // Match is inside this backtick span if it overlaps
    if (matchStart >= spanStart && matchEnd <= spanEnd) {
      return true;
    }
  }
  return false;
}

// ─── Pattern Definitions ────────────────────────────────────────────
// Based on real-world attack patterns from:
// - VirusTotal ClawHub skill analysis (Feb 2026)
// - Snyk OpenClaw vulnerability report
// - Cisco AI Defense 26% vulnerability rate
// - "What Would Elon Do?" malware incident

interface SecurityPattern {
  id: string;
  name: string;
  severity: SecuritySeverity;
  patterns: RegExp[];
  description: string;
  reference: string;
}

const SECURITY_PATTERNS: SecurityPattern[] = [
  // ── Data Exfiltration ─────────────────────────────────────────
  {
    id: 'SEC_EXFIL_FETCH',
    name: 'Network exfiltration via fetch/HTTP',
    severity: 'critical',
    patterns: [
      /fetch\s*\(\s*['"`]https?:\/\/(?!(?:localhost|127\.0\.0\.1|api\.anthropic\.com|api\.openai\.com))/gi,
      /(?:XMLHttpRequest|axios|got|node-fetch|undici)\s*[.(]/gi,
      /https?:\/\/[^'"\s]*(?:webhook|hook|exfil|recv|collect|log|track|ping|beacon|report)/gi,
    ],
    description: 'Skill makes outbound HTTP requests to external servers. Could exfiltrate context data, API keys, or conversation history.',
    reference: 'VirusTotal: "What Would Elon Do?" skill performed silent data exfiltration',
  },
  {
    id: 'SEC_EXFIL_DNS',
    name: 'DNS-based data exfiltration',
    severity: 'critical',
    patterns: [
      /dns\.resolve|dns\.lookup|dgram\.createSocket/gi,
      /\.burpcollaborator\.|\.oastify\.|\.interact\.sh|\.dnsbin\./gi,
    ],
    description: 'Potential DNS-based data exfiltration channel — data encoded in DNS queries bypasses most firewalls.',
    reference: 'Authmind: DNS exfiltration used in MCP credential theft',
  },

  // ── Prompt Injection ──────────────────────────────────────────
  {
    id: 'SEC_INJECT_HIDDEN',
    name: 'Hidden prompt injection via encoding',
    severity: 'critical',
    patterns: [
      /\\u[0-9a-fA-F]{4}(?:\\u[0-9a-fA-F]{4}){3,}/g,     // Unicode escape sequences
      /&#x[0-9a-fA-F]+;(?:&#x[0-9a-fA-F]+;){3,}/g,        // HTML entity encoding
      /(?:atob|btoa|Buffer\.from)\s*\(\s*['"`][A-Za-z0-9+/=]{20,}/g, // Base64 payloads
      /%[0-9a-fA-F]{2}(?:%[0-9a-fA-F]{2}){5,}/g,           // URL encoding chains
    ],
    description: 'Encoded content that could contain hidden instructions. Attackers use encoding to bypass skill review.',
    reference: 'Snyk: encoded payloads in SKILL.md bypass manual code review',
  },
  {
    id: 'SEC_INJECT_ROLE',
    name: 'System role override attempt',
    severity: 'high',
    patterns: [
      /(?:system|assistant)\s*:\s*(?:you are|ignore|forget|disregard|override)/gi,
      /\bignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|rules?|constraints?)/gi,
      /\byou\s+are\s+now\s+(?:a|an|the)\b/gi,
      /\b(?:jailbreak|DAN|do anything now)\b/gi,
    ],
    description: 'Attempts to override the agent\'s system instructions through prompt injection embedded in skill content.',
    reference: 'CNBC/Palo Alto: "lethal trifecta" — skills with prompt injection access private data',
  },
  {
    id: 'SEC_INJECT_DELIMITER',
    name: 'Instruction delimiter manipulation',
    severity: 'high',
    patterns: [
      /<\/?(?:system|user|assistant|human|claude|instructions?)>/gi,
      /```(?:system|instructions|override|hidden)\b/gi,
      /\[INST\]|\[\/INST\]|<\|im_start\|>|<\|im_end\|>/g,
    ],
    description: 'XML/chat delimiters that could inject instructions into a different role boundary.',
    reference: 'Semgrep: "Cannot secure the reasoning layer; must sandbox execution"',
  },

  // ── Credential Access ─────────────────────────────────────────
  {
    id: 'SEC_CRED_ENV',
    name: 'Environment variable / credential access',
    severity: 'high',
    patterns: [
      /process\.env\[?\s*['"`](?!NODE_ENV|PATH|HOME|LANG|TERM)/gi,
      /os\.environ|os\.getenv/gi,
      /(?:ANTHROPIC|OPENAI|CLAUDE|AWS|AZURE|GCP|GITHUB|STRIPE|SLACK)_(?:API_?KEY|SECRET|TOKEN)/gi,
      /\.env(?:\.local|\.production|\.secret)?/gi,
    ],
    description: 'Skill accesses environment variables or credential stores. Could leak API keys or service tokens.',
    reference: 'Authmind: 12.8M secrets leaked on public GitHub; MCP instances with plaintext API keys',
  },
  {
    id: 'SEC_CRED_FILE',
    name: 'Sensitive file access patterns',
    severity: 'high',
    patterns: [
      /(?:\/etc\/passwd|\/etc\/shadow|~\/\.ssh|~\/\.aws|~\/\.gnupg)/gi,
      /\.pem|\.key|\.p12|\.pfx|id_rsa|id_ed25519/gi,
      /credentials\.json|service[_-]?account.*\.json|keyfile/gi,
      /\/\.claude\/.*(?:settings|config|auth)/gi,
    ],
    description: 'Attempts to read SSH keys, cloud credentials, certificates, or authentication files.',
    reference: 'Cisco AI Defense: 26% of skills contained vulnerability patterns including file access',
  },

  // ── Code Execution ────────────────────────────────────────────
  {
    id: 'SEC_EXEC_SHELL',
    name: 'Shell command execution',
    severity: 'high',
    patterns: [
      /(?:child_process|exec|execSync|spawn|execFile)\s*[.(]/gi,
      /(?:subprocess|os\.system|os\.popen|Popen)\s*\(/gi,
      /\$\(.*\)|`.*`/g,  // Backtick or $() command substitution (only in code blocks)
      /(?:curl|wget|nc|netcat|ncat)\s+/gi,
    ],
    description: 'Skill executes shell commands. Could run arbitrary code on the host system.',
    reference: 'OpenClaw security model: Identity → Scope → Model separation required',
  },
  {
    id: 'SEC_EXEC_EVAL',
    name: 'Dynamic code evaluation',
    severity: 'high',
    patterns: [
      /\beval\s*\(/gi,
      /\bnew\s+Function\s*\(/gi,
      /\bimport\s*\(\s*['"`][^'"]*['"`]\s*\)/gi,  // Dynamic imports
      /\b(?:__import__|importlib\.import_module)\s*\(/gi,
    ],
    description: 'Dynamic code evaluation could execute injected payloads at runtime.',
    reference: 'VirusTotal Code Insight: analyzes "what code ACTUALLY does" vs. what it claims',
  },

  // ── Persistence & Stealth ─────────────────────────────────────
  {
    id: 'SEC_PERSIST',
    name: 'Persistence mechanisms',
    severity: 'medium',
    patterns: [
      /cron(?:tab)?|at\s+\d|systemctl\s+enable|launchd/gi,
      /autostart|startup|boot|init\.d/gi,
      /(?:setInterval|setTimeout)\s*\(.*(?:60000|3600000|86400000)/gi, // Periodic callbacks
    ],
    description: 'Skill attempts to establish persistence (scheduled tasks, auto-start, periodic callbacks).',
    reference: 'Tom\'s Hardware: Clawdbot agent "never sleeps" — persistence is an attack vector',
  },
  {
    id: 'SEC_STEALTH_COMMENTS',
    name: 'Instructions hidden in comments',
    severity: 'medium',
    patterns: [
      /<!--[\s\S]*?(?:ignore|override|system|fetch|send|upload|exfil|secret)[\s\S]*?-->/gi,
      /\/\*[\s\S]*?(?:ignore|override|system|fetch|send|upload|exfil|secret)[\s\S]*?\*\//gi,
    ],
    description: 'Suspicious keywords found inside HTML/code comments — a common technique to hide malicious instructions.',
    reference: 'Prompt injection attacks use comment-hidden instructions to bypass human review',
  },

  // ── Obfuscation ───────────────────────────────────────────────
  {
    id: 'SEC_OBFUSC',
    name: 'Code obfuscation patterns',
    severity: 'medium',
    patterns: [
      /String\.fromCharCode\s*\(/gi,
      /\bchar\s*\(\s*\d+\s*\)/gi,
      /(?:[a-zA-Z_$][\w$]*\s*=\s*){5,}/g,  // Variable chains (obfuscated assignment)
      /0x[0-9a-fA-F]{2}(?:\s*,\s*0x[0-9a-fA-F]{2}){10,}/g, // Hex byte arrays
      /\\x[0-9a-fA-F]{2}(?:\\x[0-9a-fA-F]{2}){5,}/g,
    ],
    description: 'Obfuscated code patterns suggest intentional concealment of functionality.',
    reference: 'ClawHub malware used obfuscation to hide data exfiltration in skill code',
  },

  // ── Information Gathering ─────────────────────────────────────
  {
    id: 'SEC_RECON',
    name: 'System reconnaissance',
    severity: 'low',
    patterns: [
      /os\.(?:platform|arch|hostname|userInfo|networkInterfaces)/gi,
      /process\.(?:pid|ppid|arch|platform|version)/gi,
      /navigator\.(?:userAgent|platform)/gi,
      /(?:whoami|hostname|uname|ifconfig|ipconfig)/gi,
    ],
    description: 'Skill gathers system information that could be used for fingerprinting or targeted attacks.',
    reference: 'Reconnaissance is first stage of attack chain in compromised agent skills',
  },
];

// ─── Scanner ────────────────────────────────────────────────────────

export function scanSkillSecurity(file: AgentFile): SecurityReport {
  const config = getSecurityConfig();
  const allowSet = new Set(config.allowlist.map(c => c.toUpperCase()));
  const codeBlockLines = config.codeBlockAware ? getCodeBlockLines(file.content) : new Set<number>();

  // Build trusted-domain regex for SEC_EXFIL_FETCH URL allowlisting
  const trustedHostRe = config.trustedDomains.length > 0
    ? new RegExp(config.trustedDomains.map(d => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
    : null;

  const findings: SecurityFinding[] = [];
  const lines = file.content.split('\n');

  for (const pattern of SECURITY_PATTERNS) {
    // Skip entirely if this code is in the allowlist
    if (allowSet.has(pattern.id.toUpperCase())) { continue; }

    for (const regex of pattern.patterns) {
      // Reset regex state
      const re = new RegExp(regex.source, regex.flags);

      for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        let match: RegExpExecArray | null;

        // Clone regex per line to reset lastIndex
        const lineRe = new RegExp(re.source, re.flags);

        while ((match = lineRe.exec(line)) !== null) {
          // Check trusted domains for URL-based findings
          if (pattern.id === 'SEC_EXFIL_FETCH' && trustedHostRe && trustedHostRe.test(match[0])) {
            // Prevent infinite loops on zero-length matches
            if (match[0].length === 0) { break; }
            continue; // skip — URL matches a trusted domain
          }

          // Determine suppression: code blocks, inline backtick spans, or table cells with code refs
          const inCodeBlock = codeBlockLines.has(lineIdx);
          const inInlineCode = config.codeBlockAware && isInsideInlineCode(line, match.index, match.index + match[0].length);
          const suppressed = inCodeBlock || inInlineCode;
          const suppressReason = inCodeBlock
            ? 'Inside markdown code block (documentation example)'
            : inInlineCode
              ? 'Inside inline backtick span (code reference)'
              : undefined;

          findings.push({
            line: lineIdx,
            column: match.index,
            endColumn: match.index + match[0].length,
            severity: pattern.severity,
            code: pattern.id,
            message: pattern.name,
            detail: pattern.description,
            matchedText: match[0].substring(0, 60),
            suppressed,
            suppressReason,
          });

          // Prevent infinite loops on zero-length matches
          if (match[0].length === 0) { break; }
        }
      }
    }
  }

  // Deduplicate findings on same line with same code
  const deduped = deduplicateFindings(findings);

  // Separate active vs suppressed findings for scoring
  const activeFindings = deduped.filter(f => !f.suppressed);
  const suppressedCount = deduped.filter(f => f.suppressed).length;

  // Calculate security score based on active findings only
  const score = calculateSecurityScore(activeFindings);
  const verdict: SecurityReport['verdict'] =
    score >= 80 ? 'clean' :
    score >= 40 ? 'suspicious' :
    'dangerous';

  return { file, findings: deduped, suppressedCount, score, verdict };
}

function deduplicateFindings(findings: SecurityFinding[]): SecurityFinding[] {
  const seen = new Set<string>();
  return findings.filter(f => {
    const key = `${f.line}:${f.code}`;
    if (seen.has(key)) { return false; }
    seen.add(key);
    return true;
  });
}

function calculateSecurityScore(findings: SecurityFinding[]): number {
  let deductions = 0;
  for (const f of findings) {
    switch (f.severity) {
      case 'critical': deductions += 25; break;
      case 'high':     deductions += 15; break;
      case 'medium':   deductions += 8;  break;
      case 'low':      deductions += 3;  break;
      case 'info':     deductions += 1;  break;
    }
  }
  return Math.max(0, 100 - deductions);
}

// ─── Diagnostics Integration ────────────────────────────────────────

export function addSecurityDiagnostics(
  report: SecurityReport,
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): void {
  const activeCount = report.findings.filter(f => !f.suppressed).length;
  const suppNote = report.suppressedCount > 0
    ? ` (${report.suppressedCount} suppressed — code blocks or allowlist)`
    : '';

  // File-level verdict
  if (report.verdict !== 'clean') {
    const diag = new vscode.Diagnostic(
      new vscode.Range(0, 0, 0, 0),
      `🔒 Security scan: ${report.verdict.toUpperCase()} (score: ${report.score}/100). ` +
      `${activeCount} active finding(s)${suppNote}. ` +
      (report.verdict === 'dangerous'
        ? 'DO NOT USE this skill without thorough review.'
        : 'Review findings before enabling this skill.'),
      report.verdict === 'dangerous'
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning
    );
    diag.source = 'ClawdContext Security';
    diag.code = 'SKILL_SECURITY';
    addDiag(report.file.uri, diag);
  }

  // Individual findings — only emit diagnostics for non-suppressed findings
  for (const finding of report.findings) {
    if (finding.suppressed) { continue; }

    const severity =
      finding.severity === 'critical' ? vscode.DiagnosticSeverity.Error :
      finding.severity === 'high' ? vscode.DiagnosticSeverity.Error :
      finding.severity === 'medium' ? vscode.DiagnosticSeverity.Warning :
      vscode.DiagnosticSeverity.Information;

    const diag = new vscode.Diagnostic(
      new vscode.Range(finding.line, finding.column, finding.line, finding.endColumn),
      `🛡️ ${finding.message}: ${finding.detail.substring(0, 120)}`,
      severity
    );
    diag.source = 'ClawdContext Security';
    diag.code = finding.code;
    addDiag(report.file.uri, diag);
  }
}

// ─── Scan All Skills ────────────────────────────────────────────────

export function scanAllSkills(
  files: AgentFile[],
  addDiag: (uri: vscode.Uri, diag: vscode.Diagnostic) => void
): SecurityReport[] {
  const reports: SecurityReport[] = [];

  for (const file of files) {
    if (file.layer === 'skill') {
      const report = scanSkillSecurity(file);
      reports.push(report);
      addSecurityDiagnostics(report, addDiag);
    }
  }

  return reports;
}
