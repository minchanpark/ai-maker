import {
  FOCUS_AREA_OPTIONS,
  HOOK_EVENT_OPTIONS,
  PERMISSION_DEFAULT_TOOLS,
} from '@/lib/constants/domain';
import { requestClaudeToolDraft } from '@/lib/ai/claudeToolDesigner';
import { generateAgentMd } from '@/lib/generators/agentGenerator';
import { generateHookFiles } from '@/lib/generators/hookGenerator';
import { generateReadme } from '@/lib/generators/readmeGenerator';
import { generateSkillMd } from '@/lib/generators/skillGenerator';
import type {
  AgentInput,
  FocusArea,
  GeneratedFile,
  GeneratedPackage,
  HookEvent,
  HookInput,
  PermissionMode,
  ProjectInput,
  Role,
  SkillInput,
} from '@/types';

const CLAUDE_DEFAULT_MODEL = 'claude-sonnet-4-5';

const ROLE_BY_FOCUS: Record<FocusArea, Role> = {
  planning: 'planner',
  design: 'designer',
  development: 'developer',
};

const STOPWORDS = new Set([
  '그리고',
  '에서',
  '으로',
  '하는',
  '위한',
  '대한',
  '프로젝트',
  '서비스',
  '사용자',
  '고객',
  '팀',
  '있습니다',
  '합니다',
  'the',
  'and',
  'for',
  'with',
  'that',
]);

function uniq<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function mergeWarnings(...warningSets: string[][]): string[] {
  return uniq(
    warningSets
      .flat()
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function tokenize(text: string): string[] {
  return text
    .split(/[\s,./|()\[\]{}!?:;"'`~<>-]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2)
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !STOPWORDS.has(token.toLowerCase()));
}

function slugifyName(name: string): string {
  const ascii = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return ascii || 'project-assistant';
}

function derivePrimaryRole(focusAreas: FocusArea[]): Role {
  const ordered = FOCUS_AREA_OPTIONS.map((option) => option.value);
  const first = ordered.find((focus) => focusAreas.includes(focus)) ?? focusAreas[0];
  return ROLE_BY_FOCUS[first];
}

function deriveKeywords(input: ProjectInput): string[] {
  const collected = uniq(
    [
      ...tokenize(input.projectName),
      ...tokenize(input.ideaSummary),
      ...tokenize(input.targetUsers),
      ...tokenize(input.problemStatement),
      ...input.coreFeatures.flatMap((feature) => tokenize(feature)),
    ].map((item) => item.slice(0, 20)),
  );

  if (collected.length === 0) {
    return ['아이디어', '기획', '실행'];
  }

  return collected.slice(0, 10);
}

function deriveQualityCriteria(input: ProjectInput): string[] {
  const byMode: Record<ProjectInput['collaborationMode'], string[]> = {
    balanced: ['명확한 작업 분해', '검증 가능한 산출물', '협업 친화적 문서화'],
    speed: ['빠른 초안 생성', '짧은 피드백 루프', '반복 개선 우선'],
    safe: ['실수 예방 중심', '검증 체크리스트 강화', '보수적 변경 원칙'],
  };

  const byFocus: Record<FocusArea, string[]> = {
    planning: ['우선순위 명확화', '수용 기준 명시'],
    design: ['상태 UI 포함', '접근성 고려'],
    development: ['타입 안정성', '테스트 가능성'],
  };

  const focusCriteria = input.focusAreas.flatMap((focus) => byFocus[focus]);
  return uniq([...byMode[input.collaborationMode], ...focusCriteria]).slice(0, 7);
}

function deriveOutputFormat(input: ProjectInput): string {
  if (input.focusAreas.length >= 3) {
    return '문제 요약 -> 우선순위 -> 실행 계획 -> 검증 체크리스트';
  }

  if (input.focusAreas.includes('planning')) {
    return '요구사항 요약 -> 우선순위 -> 실행 단계';
  }

  if (input.focusAreas.includes('design')) {
    return '사용자 흐름 -> 화면/상태 스펙 -> 구현 가이드';
  }

  return '작업 분해 -> 코드/설정 제안 -> 검증 순서';
}

function deriveSkillInput(input: ProjectInput): SkillInput {
  const baseSlug = slugifyName(input.projectName);
  const name = `${baseSlug}-orchestrator`.slice(0, 48);

  return {
    name,
    description: `${input.projectName} 아이디어를 바탕으로 실행 가능한 Skill/Hook/Agent 구성을 자동 설계하는 오케스트레이션 스킬`,
    triggerKeywords: deriveKeywords(input),
    qualityCriteria: deriveQualityCriteria(input),
    outputFormat: deriveOutputFormat(input),
  };
}

function toPathLike(items: string[]): string[] {
  return items.filter((item) => item.includes('/') || item.includes('.') || item.includes('-'));
}

function sortHookEvents(events: HookEvent[]): HookEvent[] {
  return HOOK_EVENT_OPTIONS.filter((event) => events.includes(event));
}

function deriveHookInput(input: ProjectInput): HookInput {
  const tools = new Set<string>();
  const events: HookEvent[] = ['SessionStart'];
  const targetExtensions = new Set<string>(['.md']);

  if (input.focusAreas.includes('development')) {
    targetExtensions.add('.ts');
    targetExtensions.add('.tsx');
    targetExtensions.add('.js');
    targetExtensions.add('.jsx');
    if (input.automationLevel !== 'minimal') {
      tools.add('prettier');
      tools.add('eslint');
    }
  }

  if (input.focusAreas.includes('design')) {
    targetExtensions.add('.css');
    targetExtensions.add('.scss');
    targetExtensions.add('.tsx');
    if (input.automationLevel !== 'minimal') {
      tools.add('prettier');
      tools.add('stylelint');
      tools.add('storybook');
    }
  }

  if (input.automationLevel !== 'minimal' && tools.size > 0) {
    events.push('PostToolUse');
  }

  const pathLike = toPathLike(input.nonNegotiables);
  const protectedPaths =
    pathLike.length > 0 ? pathLike : input.collaborationMode === 'safe' ? ['.env', 'package-lock.json', 'yarn.lock'] : [];

  if (protectedPaths.length > 0) {
    events.push('PreToolUse');
  }

  if (input.automationLevel === 'aggressive') {
    events.push('Notification');
  }

  return {
    events: sortHookEvents(uniq(events)),
    targetExtensions: Array.from(targetExtensions),
    tools: Array.from(tools),
    protectedPaths,
  };
}

function normalizeHookInput(input: HookInput): HookInput {
  return {
    events: sortHookEvents(uniq(input.events)),
    targetExtensions: uniq(input.targetExtensions),
    tools: uniq(input.tools),
    protectedPaths: uniq(input.protectedPaths),
  };
}

function createAgent(name: string, permissionMode: PermissionMode, roleDescription: string, useMemory = false): AgentInput {
  return {
    name,
    roleDescription,
    permissionMode,
    tools: PERMISSION_DEFAULT_TOOLS[permissionMode],
    useMemory,
  };
}

function deriveAgents(input: ProjectInput): AgentInput[] {
  const agents: AgentInput[] = [];

  if (input.focusAreas.includes('planning')) {
    agents.push(
      createAgent('requirement-reviewer', 'plan', '아이디어를 실행 가능한 요구사항으로 검토합니다.'),
      createAgent('strategy-planner', 'default', '우선순위와 실행 로드맵을 정리합니다.'),
    );
  }

  if (input.focusAreas.includes('design')) {
    agents.push(
      createAgent('ui-designer', 'plan', '사용자 경험 중심의 화면/상태 스펙을 정리합니다.'),
      createAgent('design-system-keeper', 'default', '디자인 시스템 일관성을 유지합니다.', true),
    );
  }

  if (input.focusAreas.includes('development')) {
    agents.push(
      createAgent('frontend-implementer', 'acceptEdits', '구현 가능한 코드 변경안을 작성합니다.'),
      createAgent('a11y-auditor', 'plan', '접근성 리스크를 점검합니다.'),
    );
  }

  return uniq(agents.map((agent) => JSON.stringify(agent))).map((item) => JSON.parse(item) as AgentInput);
}

function deriveWarnings(input: ProjectInput, hookInput: HookInput): string[] {
  const warnings: string[] = [];

  if (input.collaborationMode === 'safe' && input.nonNegotiables.length === 0) {
    warnings.push('안전형 모드로 선택되어 기본 보호 경로(.env, lock files)를 자동 적용했습니다.');
  }

  if (input.automationLevel === 'minimal' && input.focusAreas.includes('development')) {
    warnings.push('개발 중점이지만 최소 자동화를 선택해 PostToolUse 검증 훅이 제한됩니다.');
  }

  if (hookInput.events.length === 1 && hookInput.events[0] === 'SessionStart') {
    warnings.push('자동 실행 훅이 SessionStart만 생성되었습니다.');
  }

  return warnings;
}

interface GenerationSpec {
  primaryRole: Role;
  skillInput: SkillInput;
  hookInput: HookInput;
  agents: AgentInput[];
  warnings: string[];
  generationSource: 'rules' | 'claude';
}

function createRuleBasedSpec(input: ProjectInput): Omit<GenerationSpec, 'generationSource'> {
  const primaryRole = derivePrimaryRole(input.focusAreas);
  const skillInput = deriveSkillInput(input);
  const hookInput = deriveHookInput(input);
  const agents = deriveAgents(input);
  const warnings = deriveWarnings(input, hookInput);

  return {
    primaryRole,
    skillInput,
    hookInput,
    agents,
    warnings,
  };
}

function buildGeneratedPackage(input: ProjectInput, spec: GenerationSpec): GeneratedPackage {
  const { primaryRole, skillInput, hookInput, agents, warnings, generationSource } = spec;

  const files: GeneratedFile[] = [];

  files.push({
    path: `skills/${skillInput.name}/SKILL.md`,
    content: generateSkillMd(skillInput, primaryRole),
    type: 'skill',
    language: 'markdown',
  });

  files.push(...generateHookFiles(hookInput));

  const context = {
    projectName: input.projectName,
    ideaSummary: input.ideaSummary,
    focusAreas: input.focusAreas,
    triggerKeywords: skillInput.triggerKeywords,
  };

  agents.forEach((agent) => {
    files.push({
      path: `agents/${agent.name}.md`,
      content: generateAgentMd(agent, context),
      type: 'agent',
      language: 'markdown',
    });
  });

  const readme = generateReadme(input, files);

  return {
    files,
    readme,
    projectInput: input,
    blueprint: {
      primaryRole,
      skillName: skillInput.name,
      triggerKeywords: skillInput.triggerKeywords,
      hookEvents: hookInput.events,
      agentNames: agents.map((agent) => agent.name),
    },
    generationSource,
    warnings,
  };
}

export function createGeneratedPackage(input: ProjectInput): GeneratedPackage {
  const spec = createRuleBasedSpec(input);
  return buildGeneratedPackage(input, {
    ...spec,
    generationSource: 'rules',
  });
}

function shouldUseClaudeGeneration(): boolean {
  if (process.env.NODE_ENV === 'test') {
    return false;
  }

  return process.env.CLAUDE_GENERATION_DISABLED !== 'true';
}

export async function createGeneratedPackageWithClaude(input: ProjectInput): Promise<GeneratedPackage> {
  const fallbackSpec = createRuleBasedSpec(input);

  if (!shouldUseClaudeGeneration()) {
    return buildGeneratedPackage(input, {
      ...fallbackSpec,
      generationSource: 'rules',
    });
  }

  const apiKey = process.env.CLAUDE_API_KEY ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return buildGeneratedPackage(input, {
      ...fallbackSpec,
      generationSource: 'rules',
      warnings: mergeWarnings(
        fallbackSpec.warnings,
        ['CLAUDE_API_KEY가 없어 규칙 기반 생성으로 진행했습니다.'],
      ),
    });
  }

  const model = process.env.CLAUDE_MODEL?.trim() || CLAUDE_DEFAULT_MODEL;

  try {
    const draft = await requestClaudeToolDraft({
      input,
      fallback: {
        skill: fallbackSpec.skillInput,
        hook: fallbackSpec.hookInput,
        agents: fallbackSpec.agents,
      },
      apiKey,
      model,
    });

    return buildGeneratedPackage(input, {
      primaryRole: fallbackSpec.primaryRole,
      skillInput: draft.skill,
      hookInput: normalizeHookInput(draft.hook),
      agents: draft.agents,
      generationSource: 'claude',
      warnings: mergeWarnings(
        fallbackSpec.warnings,
        draft.warnings,
        [`Claude API(${model})를 사용해 생성했습니다.`],
      ),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return buildGeneratedPackage(input, {
      ...fallbackSpec,
      generationSource: 'rules',
      warnings: mergeWarnings(
        fallbackSpec.warnings,
        [`Claude 생성 실패로 규칙 기반 생성을 사용했습니다: ${reason}`],
      ),
    });
  }
}
