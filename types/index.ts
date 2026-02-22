export type Role = 'planner' | 'designer' | 'developer';
export type PermissionMode = 'plan' | 'default' | 'acceptEdits';

export type FocusArea = 'planning' | 'design' | 'development';
export type CollaborationMode = 'balanced' | 'speed' | 'safe';
export type AutomationLevel = 'minimal' | 'recommended' | 'aggressive';

export type HookEvent =
  | 'PreToolUse'
  | 'PostToolUse'
  | 'SessionStart'
  | 'Stop'
  | 'Notification';

export type GeneratedFileType = 'skill' | 'hook-config' | 'hook-script' | 'agent';
export type GeneratedLanguage = 'markdown' | 'json' | 'bash' | 'python';

export interface SkillInput {
  name: string;
  description: string;
  triggerKeywords: string[];
  qualityCriteria: string[];
  outputFormat: string;
}

export interface HookInput {
  events: HookEvent[];
  targetExtensions: string[];
  tools: string[];
  protectedPaths: string[];
}

export interface AgentInput {
  name: string;
  roleDescription: string;
  permissionMode: PermissionMode;
  tools: string[];
  useMemory: boolean;
}

export interface ProjectInput {
  projectName: string;
  ideaSummary: string;
  targetUsers: string;
  problemStatement: string;
  coreFeatures: string[];
  successCriteria: string;
  nonNegotiables: string[];
  focusAreas: FocusArea[];
  collaborationMode: CollaborationMode;
  automationLevel: AutomationLevel;
}

export interface GeneratedFile {
  path: string;
  content: string;
  type: GeneratedFileType;
  language: GeneratedLanguage;
}

export interface GenerationBlueprint {
  primaryRole: Role;
  skillName: string;
  triggerKeywords: string[];
  hookEvents: HookEvent[];
  agentNames: string[];
}

export type GenerationSource = 'rules' | 'claude';

export type ChatRole = 'user' | 'assistant' | 'system';

export interface FileUpdatePayload {
  path: string;
  before: string;
  after: string;
  summary: string[];
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  status?: 'streaming' | 'done' | 'error';
  fileUpdate?: FileUpdatePayload;
  error?: string;
}

export interface ChatHistoryMessage {
  role: Extract<ChatRole, 'user' | 'assistant'>;
  content: string;
}

export interface ChatRequestPayload {
  message: string;
  selectedFile: GeneratedFile;
  availablePaths: string[];
  projectInput: ProjectInput;
  blueprint: GenerationBlueprint;
  history: ChatHistoryMessage[];
}

export interface ContextBudgetConfig {
  totalBudgetChars: number;
  fileBudgetChars: number;
  historyBudgetChars: number;
  maxMessageChars: number;
  maxHistoryTurns: number;
  maxHistoryTurnChars: number;
  pinnedHistoryTurns: number;
  historySummaryMaxChars: number;
  fileHeadLines: number;
  fileTailLines: number;
  fileWindowPadding: number;
  fileMaxWindows: number;
  promptOverheadChars: number;
}

export interface ContextAssemblyStats {
  messageChars: number;
  fileCharsUsed: number;
  historyCharsUsed: number;
  historyTurnsReceived: number;
  historyTurnsUsed: number;
  historyTurnsSummarized: number;
  trimmedChars: number;
  appliedPolicy: 'quality_guard_v1' | 'legacy';
}

export interface ContextAssemblyResult {
  message: string;
  history: ChatHistoryMessage[];
  historySummary: string;
  fileContext: string;
  stats: ContextAssemblyStats;
  budget: ContextBudgetConfig;
}

export interface QualityScoreBreakdown {
  beforeScore: number;
  afterScore: number;
  syntaxScore: number;
  structureScore: number;
  keywordRetentionScore: number;
  stabilityScore: number;
  changeRatio: number;
  threshold: number;
  anchorRetentionRatio: number;
}

export interface QualityGateResult {
  ok: boolean;
  reason?: string;
  scores: QualityScoreBreakdown;
}

export type ChatSseEvent =
  | {
      event: 'token';
      data: { text: string };
    }
  | {
      event: 'file_update';
      data: FileUpdatePayload;
    }
  | {
      event: 'error';
      data: { message: string };
    }
  | {
      event: 'done';
      data: { ok: boolean };
    };

export interface GeneratedPackage {
  files: GeneratedFile[];
  readme: string;
  projectInput: ProjectInput;
  blueprint: GenerationBlueprint;
  generationSource: GenerationSource;
  warnings?: string[];
}
