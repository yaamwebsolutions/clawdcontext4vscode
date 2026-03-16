/**
 * Skill Forge Studio — Module Index.
 *
 * Barrel exports for the skill forge integration.
 */

export { SfsClient } from './sfsClient';
export type { SfsHealthResponse, SfsProvider, SfsGeneratedFile, SfsGenerateResponse, SfsValidationResult, SfsRecommendation, SfsRecommendResponse, SfsSkillConfig, SfsRegenerateRequest } from './sfsClient';
export { SfsServerManager } from './serverManager';
export type { ServerStatus } from './serverManager';
export { openSkillForgePanel } from './skillForgePanel';
export type { SkillForgePanelDeps } from './skillForgePanel';
export { getAiBridgeStatus, buildBridgeConfig, sfsHasAiProvider, promptAiSetup } from './aiBridge';
export type { AiBridgeStatus } from './aiBridge';
export { generateOfflineSkill } from './templates';
export { getSkillForgeWebviewHtml } from './webviewHtml';
