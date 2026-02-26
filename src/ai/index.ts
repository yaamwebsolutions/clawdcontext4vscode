/**
 * @module ai
 * Barrel export for AI capabilities.
 */

// ─── Provider ───────────────────────────────────────────────────────

export {
  aiComplete,
  testAiConnection,
  isAiEnabled,
  getAiConfig,
  getProviderLabel,
} from './provider';

export type {
  AiProvider,
  AiMessage,
  AiCompletionOptions,
  AiCompletionResult,
  AiConfig,
} from './provider';

// ─── Prompts ────────────────────────────────────────────────────────

export {
  SYSTEM_PROMPT_ANALYST,
  SYSTEM_PROMPT_VALIDATOR,
  SYSTEM_PROMPT_GENERATOR,
  SYSTEM_PROMPT_FIXER,
  SYSTEM_PROMPT_CONTRADICTION,
} from './prompts';

// ─── AI Validator ───────────────────────────────────────────────────

export {
  validateFile,
  validateWorkspace,
  detectContradictions,
  fixFile,
  computeQualityGate,
} from './aiValidator';

export type {
  Violation,
  ValidationResult,
  ContradictionResult,
  QualityGate,
} from './aiValidator';

// ─── AI Generator ───────────────────────────────────────────────────

export {
  generateMissing,
  generateFile,
  fixFileFromViolations,
} from './aiGenerator';

export type {
  GenerateTarget,
  GeneratedFile,
  GenerationResult,
} from './aiGenerator';

// ─── Commands ───────────────────────────────────────────────────────

export {
  // Existing
  aiTestConnection,
  aiReviewConfig,
  aiExplainDiagnostic,
  aiSuggestRefactor,
  aiSecurityReview,
  // New — eurka/future integration
  aiValidateWorkspace,
  aiValidateFile,
  aiGenerateMissing,
  aiGenerateFile,
  aiFixCurrentFile,
  aiDetectContradictions,
} from './commands';
