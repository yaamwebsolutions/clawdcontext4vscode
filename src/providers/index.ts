/**
 * @module providers
 * Barrel export for VS Code UI providers.
 */

export { LayersTreeProvider, HealthTreeProvider, LessonsTreeProvider } from './treeProvider';
export { LessonsCodeLensProvider } from './codeLensProvider';
export { StatusBarManager } from './statusBar';
export {
  ClawdContextCodeActionProvider,
  extractProcedureCommand,
  moveToLessonsCommand,
  archiveDeprecatedCommand,
  analyzeBloatCommand,
} from './codeActionProvider';
