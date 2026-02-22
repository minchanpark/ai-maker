import { PERMISSION_DEFAULT_TOOLS } from '@/lib/constants/domain';
import type { AgentInput, FocusArea, PermissionMode } from '@/types';

export interface AgentGenerationContext {
  projectName: string;
  ideaSummary: string;
  focusAreas: FocusArea[];
  triggerKeywords: string[];
}

const PERMISSION_RULES: Record<PermissionMode, string[]> = {
  plan: ['reviewer', 'auditor', 'analyzer', 'checker'],
  default: ['designer', 'keeper', 'planner'],
  acceptEdits: ['implementer', 'developer', 'builder'],
};

function inferPermissionMode(name: string): PermissionMode {
  const lowered = name.toLowerCase();

  for (const [mode, keywords] of Object.entries(PERMISSION_RULES) as [PermissionMode, string[]][]) {
    if (keywords.some((keyword) => lowered.includes(keyword))) {
      return mode;
    }
  }

  return 'default';
}

export function normalizeAgent(agent: AgentInput): AgentInput {
  const permissionMode = agent.permissionMode || inferPermissionMode(agent.name);
  const defaultTools = PERMISSION_DEFAULT_TOOLS[permissionMode];

  const safeTools = agent.tools.filter((tool) => defaultTools.includes(tool));

  return {
    ...agent,
    permissionMode,
    tools: safeTools.length > 0 ? safeTools : defaultTools,
  };
}

export function generateAgentMd(agentInput: AgentInput, context: AgentGenerationContext): string {
  const agent = normalizeAgent(agentInput);

  const description = `${agent.roleDescription} ${context.projectName} 프로젝트에서 ${context.focusAreas.join('/')} 영역의 작업 품질을 유지하고, ${context.triggerKeywords.join('/')} 관련 요청을 일관되게 처리합니다.`;

  return `---
name: ${agent.name}
description: ${description}
model: inherit
permissionMode: ${agent.permissionMode}
tools:
${agent.tools.map((tool) => `  - ${tool}`).join('\n')}
---

# Role
${agent.roleDescription}

# Workflow
1. 아이디어 요약과 문제 정의를 먼저 확인한다.
2. ${agent.permissionMode} 권한 범위 안에서 안전하게 작업한다.
3. 결과물에는 변경 근거와 검증 포인트를 포함한다.

# Output format
- 작업 요약
- 변경/검토 포인트
- 다음 검증 단계

# Constraints
- 민감정보를 출력하지 않는다.
- 범위를 벗어나는 변경은 제안으로 분리한다.
`;
}
