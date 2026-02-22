import type { ChatRequestPayload } from '@/types';

interface BuildChatPromptInput {
  selectedFile: ChatRequestPayload['selectedFile'];
  availablePaths: string[];
  projectInput: ChatRequestPayload['projectInput'];
  blueprint: ChatRequestPayload['blueprint'];
  fileContext: string;
  historySummary?: string;
}

function formatList(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

export function buildChatSystemPrompt(input: BuildChatPromptInput): string {
  const { selectedFile, availablePaths, projectInput, blueprint, fileContext, historySummary } = input;
  const prompt = [
    '당신은 Claude Code의 Skill/Hook/Agent 파일 편집 전문가입니다.',
    '요청받은 범위 내에서만 수정하고, 기존 포맷과 의도를 유지하세요.',
    '',
    '[프로젝트 컨텍스트]',
    `- 프로젝트명: ${projectInput.projectName}`,
    `- 아이디어 요약: ${projectInput.ideaSummary}`,
    `- 대상 사용자: ${projectInput.targetUsers}`,
    `- 문제 정의: ${projectInput.problemStatement}`,
    `- 핵심 기능: ${projectInput.coreFeatures.join(', ')}`,
    `- 성공 기준: ${projectInput.successCriteria}`,
    `- 중점 영역: ${projectInput.focusAreas.join(', ')}`,
    `- 협업 스타일: ${projectInput.collaborationMode}`,
    `- 자동화 강도: ${projectInput.automationLevel}`,
    '',
    '[생성 결과 메타]',
    `- primaryRole: ${blueprint.primaryRole}`,
    `- skillName: ${blueprint.skillName}`,
    `- triggerKeywords: ${blueprint.triggerKeywords.join(', ')}`,
    `- hookEvents: ${blueprint.hookEvents.join(', ')}`,
    `- agents: ${blueprint.agentNames.join(', ')}`,
    '',
    '[수정 가능 파일 목록]',
    formatList(availablePaths),
    '',
    '[이번 요청의 수정 대상 파일]',
    `- path: ${selectedFile.path}`,
    `- language: ${selectedFile.language}`,
    '',
    '[현재 파일 컨텍스트]',
    `\`\`\`${selectedFile.language}`,
    fileContext,
    '\`\`\`',
    '',
  ];

  if (historySummary) {
    prompt.push('[대화 요약 메모리]', historySummary, '');
  }

  prompt.push(
    '[수정 규칙]',
    '1. 반드시 위의 수정 대상 파일만 수정합니다.',
    '2. 불필요한 대규모 리라이트를 금지합니다.',
    '3. markdown/yaml/json/bash/python 문법을 유지합니다.',
    '4. SKILL/agent 파일의 frontmatter(name, description)를 보존합니다.',
    '5. hooks/settings.json은 유효한 JSON이어야 합니다.',
    '',
    '[응답 형식 - 반드시 준수]',
    '1) 수정된 파일 전체 내용을 fenced code block 하나로 출력',
    '2) 바로 아래에 변경 요약 1~3줄을 bullet(-)로 출력',
    '3) 코드블록 외 텍스트는 최소화',
  );

  return prompt.join('\n');
}
