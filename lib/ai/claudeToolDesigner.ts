import { z } from 'zod';

import { PERMISSION_DEFAULT_TOOLS, TOOL_OPTIONS } from '@/lib/constants/domain';
import type { AgentInput, HookInput, ProjectInput, SkillInput } from '@/types';

const HOOK_EVENTS = ['PreToolUse', 'PostToolUse', 'SessionStart', 'Stop', 'Notification'] as const;
const HOOK_TOOLS = ['prettier', 'eslint', 'stylelint', 'storybook'] as const;

const skillSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z0-9-]{3,48}$/, 'skill.name must match ^[a-z0-9-]{3,48}$')
    .max(48),
  description: z.string().min(150),
  triggerKeywords: z.array(z.string().min(1).max(24)).min(3).max(12),
  qualityCriteria: z.array(z.string().min(2).max(80)).min(3).max(7),
  outputFormat: z.string().min(8).max(120),
});

const hookSchema = z
  .object({
    events: z.array(z.enum(HOOK_EVENTS)).min(1),
    targetExtensions: z
      .array(z.string().regex(/^\.[a-z0-9]+$/i, 'targetExtensions must be dot-prefixed extensions'))
      .min(1)
      .max(12),
    tools: z.array(z.enum(HOOK_TOOLS)).max(4),
    protectedPaths: z.array(z.string().min(1).max(120)).max(20),
  })
  .superRefine((hook, ctx) => {
    if (!hook.events.includes('SessionStart')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'hook.events must include SessionStart',
      });
    }
  });

const agentSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z0-9-]{3,48}$/, 'agent.name must match ^[a-z0-9-]{3,48}$')
      .max(48),
    roleDescription: z.string().min(20).max(220),
    permissionMode: z.enum(['plan', 'default', 'acceptEdits']),
    tools: z.array(z.enum(TOOL_OPTIONS)).min(1),
    useMemory: z.boolean(),
  })
  .superRefine((agent, ctx) => {
    const allowedTools = PERMISSION_DEFAULT_TOOLS[agent.permissionMode];
    if (agent.tools.some((tool) => !allowedTools.includes(tool))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `agent.tools contains unavailable tools for permissionMode=${agent.permissionMode}`,
      });
    }
  });

const claudeToolDraftSchema = z.object({
  skill: skillSchema,
  hook: hookSchema,
  agents: z.array(agentSchema).min(1).max(8),
  warnings: z.array(z.string().min(2).max(200)).max(10).optional(),
});

interface FallbackDraft {
  skill: SkillInput;
  hook: HookInput;
  agents: AgentInput[];
}

export interface ClaudeToolDraft {
  skill: SkillInput;
  hook: HookInput;
  agents: AgentInput[];
  warnings: string[];
}

function uniqStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function clip(value: string, max = 600): string {
  return value.length <= max ? value : `${value.slice(0, max)}...`;
}

function toPromptInput(input: ProjectInput): ProjectInput {
  return {
    ...input,
    projectName: clip(input.projectName, 120),
    ideaSummary: clip(input.ideaSummary, 800),
    targetUsers: clip(input.targetUsers, 400),
    problemStatement: clip(input.problemStatement, 800),
    coreFeatures: input.coreFeatures.slice(0, 8).map((feature) => clip(feature, 200)),
    successCriteria: clip(input.successCriteria, 500),
    nonNegotiables: input.nonNegotiables.slice(0, 10).map((item) => clip(item, 120)),
  };
}

function buildUserPrompt(input: ProjectInput, fallback: FallbackDraft): string {
  const promptInput = toPromptInput(input);

  return [
    '다음 입력을 기반으로 Claude Code용 Skill/Hook/Agent 초안을 생성하세요.',
    '반드시 JSON 객체 하나만 출력하고, markdown 코드펜스는 사용하지 마세요.',
    '설명과 주석 텍스트는 금지합니다. JSON 외 문자열을 출력하지 마세요.',
    '',
    '[생성 규칙]',
    '- skill.description은 150자 이상 한국어 문장으로 작성합니다.',
    '- hook.events는 SessionStart를 반드시 포함합니다.',
    '- hook.tools는 prettier|eslint|stylelint|storybook 중에서만 선택합니다.',
    '- agent.tools는 permissionMode에 맞는 도구만 선택합니다.',
    '- permissionMode=plan -> Read,Grep,Glob',
    '- permissionMode=default -> Read,Grep,Glob,Write,Edit',
    '- permissionMode=acceptEdits -> Read,Grep,Glob,Edit,Write,Bash',
    '- project 아이디어 맥락과 focusAreas에 맞춰 실무적인 문구를 작성합니다.',
    '',
    '[반환 JSON 타입]',
    '{',
    '  "skill": {',
    '    "name": "string",',
    '    "description": "string>=150",',
    '    "triggerKeywords": ["string", "..."],',
    '    "qualityCriteria": ["string", "..."],',
    '    "outputFormat": "string"',
    '  },',
    '  "hook": {',
    '    "events": ["PreToolUse|PostToolUse|SessionStart|Stop|Notification"],',
    '    "targetExtensions": [".md", ".ts"],',
    '    "tools": ["prettier|eslint|stylelint|storybook"],',
    '    "protectedPaths": ["string"]',
    '  },',
    '  "agents": [',
    '    {',
    '      "name": "string",',
    '      "roleDescription": "string",',
    '      "permissionMode": "plan|default|acceptEdits",',
    '      "tools": ["Read|Write|Edit|Bash|Grep|Glob"],',
    '      "useMemory": true',
    '    }',
    '  ],',
    '  "warnings": ["string"]',
    '}',
    '',
    '[projectInput]',
    JSON.stringify(promptInput, null, 2),
    '',
    '[fallbackDraft 참고값]',
    JSON.stringify(fallback, null, 2),
  ].join('\n');
}

function parseJsonFromText(raw: string): unknown {
  const trimmed = raw.trim();

  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return JSON.parse(fenced[1].trim());
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }

  throw new Error('Claude 응답에서 JSON 본문을 찾지 못했습니다.');
}

function extractTextContent(payload: unknown): string {
  if (!payload || typeof payload !== 'object' || !('content' in payload)) {
    return '';
  }

  const content = (payload as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const node = item as { type?: string; text?: string };
      return node.type === 'text' && typeof node.text === 'string' ? node.text : '';
    })
    .join('\n')
    .trim();
}

function normalizeDraft(draft: z.infer<typeof claudeToolDraftSchema>): ClaudeToolDraft {
  const agentsByName = new Map<string, AgentInput>();

  draft.agents.forEach((agent) => {
    if (!agentsByName.has(agent.name)) {
      agentsByName.set(agent.name, {
        ...agent,
        tools: uniqStrings(agent.tools),
      });
    }
  });

  return {
    skill: {
      ...draft.skill,
      triggerKeywords: uniqStrings(draft.skill.triggerKeywords).slice(0, 12),
      qualityCriteria: uniqStrings(draft.skill.qualityCriteria).slice(0, 7),
    },
    hook: {
      ...draft.hook,
      events: uniqStrings(draft.hook.events) as HookInput['events'],
      targetExtensions: uniqStrings(draft.hook.targetExtensions),
      tools: uniqStrings(draft.hook.tools),
      protectedPaths: uniqStrings(draft.hook.protectedPaths),
    },
    agents: Array.from(agentsByName.values()),
    warnings: uniqStrings(draft.warnings ?? []),
  };
}

function safeErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  if ('error' in payload) {
    const error = (payload as { error?: { message?: string } }).error;
    if (error && typeof error.message === 'string') {
      return error.message;
    }
  }
  return '';
}

function resolveClaudeGenerateTimeoutMs(): number {
  const raw = process.env.CLAUDE_GENERATE_TIMEOUT_MS;
  if (!raw) {
    return 45_000;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    return 45_000;
  }

  return Math.max(10_000, parsed);
}

function ensureSkillDescriptionLength(params: {
  description: string;
  input: ProjectInput;
  fallback: FallbackDraft;
}): string {
  const { description, input, fallback } = params;
  const base = (description || fallback.skill.description || '').trim();

  const fragments = [
    `${input.projectName} 프로젝트의 아이디어 맥락을 반영해 실행 가능한 작업 지침을 제공합니다.`,
    `대상 사용자(${input.targetUsers})와 문제 정의를 기반으로 우선순위와 검증 항목을 명확히 제시합니다.`,
    `${input.focusAreas.join('/')} 영역에서 재현 가능한 출력 품질을 유지하도록 체크리스트를 포함합니다.`,
  ];

  let result = base;
  for (const fragment of fragments) {
    if (result.length >= 150) {
      break;
    }
    result = `${result} ${fragment}`.trim();
  }

  while (result.length < 150) {
    result = `${result} ${fragments[fragments.length - 1]}`.trim();
  }

  return result.slice(0, 1500);
}

function repairShortSkillDescription(params: {
  rawDraft: unknown;
  input: ProjectInput;
  fallback: FallbackDraft;
}): unknown {
  const { rawDraft, input, fallback } = params;

  if (!rawDraft || typeof rawDraft !== 'object') {
    return rawDraft;
  }

  const draftRecord = rawDraft as Record<string, unknown>;
  const skill =
    draftRecord.skill && typeof draftRecord.skill === 'object'
      ? { ...(draftRecord.skill as Record<string, unknown>) }
      : {};

  const description = typeof skill.description === 'string' ? skill.description : '';
  skill.description = ensureSkillDescriptionLength({
    description,
    input,
    fallback,
  });

  return {
    ...draftRecord,
    skill,
  };
}

export async function requestClaudeToolDraft(params: {
  input: ProjectInput;
  fallback: FallbackDraft;
  apiKey: string;
  model: string;
}): Promise<ClaudeToolDraft> {
  const { input, fallback, apiKey, model } = params;
  const timeoutMs = resolveClaudeGenerateTimeoutMs();
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let response: Response;
  try {
    response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        max_tokens: 2200,
        temperature: 0.2,
        system:
          'You design practical Claude Code tools. Output must be a single JSON object that strictly follows the requested schema.',
        messages: [
          {
            role: 'user',
            content: buildUserPrompt(input, fallback),
          },
        ],
      }),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Claude API 요청이 시간 제한을 초과했습니다.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    const apiMessage = safeErrorMessage(payload);
    throw new Error(apiMessage || `Claude API 요청 실패 (status ${response.status})`);
  }

  const text = extractTextContent(payload);
  if (!text) {
    throw new Error('Claude API 응답에 텍스트 content가 없습니다.');
  }

  const rawDraft = parseJsonFromText(text);
  const parsed = claudeToolDraftSchema.safeParse(rawDraft);
  if (parsed.success) {
    return normalizeDraft(parsed.data);
  }

  const hasShortSkillDescription = parsed.error.issues.some(
    (issue) =>
      issue.code === 'too_small' &&
      issue.path.length === 2 &&
      issue.path[0] === 'skill' &&
      issue.path[1] === 'description',
  );

  if (!hasShortSkillDescription) {
    throw parsed.error;
  }

  const repairedRawDraft = repairShortSkillDescription({
    rawDraft,
    input,
    fallback,
  });
  const repairedParsed = claudeToolDraftSchema.safeParse(repairedRawDraft);
  if (!repairedParsed.success) {
    throw repairedParsed.error;
  }

  const normalized = normalizeDraft(repairedParsed.data);
  return {
    ...normalized,
    warnings: uniqStrings([
      ...normalized.warnings,
      'AI가 생성한 skill.description이 짧아 자동 보강했습니다.',
    ]),
  };
}
