import type { Role, SkillInput } from '@/types';

const ROLE_SECTIONS: Record<Role, string[]> = {
  planner: ['요구사항 분석', '우선순위 기준', '수용 기준', '이해관계자 영향'],
  designer: ['컨셉 방향', '타이포그래피', '색상 팔레트', 'loading/empty/error 상태'],
  developer: ['코드 품질', '타입 안전성', '테스트 전략', '보안'],
};

const ROLE_PHASE_TITLE: Record<Role, string> = {
  planner: '요구사항 정리와 의사결정 기준 수립',
  designer: '디자인 방향과 구현 가능한 UI 스펙 정리',
  developer: '코드 구조와 품질 기준 확정',
};

function ensureLongDescription(base: string): string {
  if (base.length >= 150) return base;
  return `${base} 이 스킬은 사용자 요청을 맥락화하고, 출력 품질을 반복 가능하게 유지하며, 실무 적용 시 누락되기 쉬운 기준을 먼저 고정하도록 돕습니다. 또한 작업 전 체크포인트와 작업 후 검증 항목을 포함해 결과물의 신뢰성을 높입니다.`;
}

export function buildSkillDescription(input: SkillInput, role: Role): string {
  const keywords = input.triggerKeywords.join('/');
  const quality = input.qualityCriteria.length
    ? input.qualityCriteria.join(', ')
    : '기본 품질 기준(명확성, 일관성, 재현성)';

  const base = `${input.description} ${keywords} 관련 요청에서 사용하며, ${role} 직무 맥락에 맞춰 ${quality} 기준을 적용합니다. 출력은 재사용 가능한 지침과 체크리스트 형태로 제공하고, 요청에 포함된 키워드와 산출물 형식을 유지합니다.`;
  return ensureLongDescription(base);
}

function buildChecklist(role: Role, input: SkillInput): string {
  return [
    `- 목적: ${input.description}`,
    `- 주요 트리거: ${input.triggerKeywords.join(', ')}`,
    `- 직무: ${role}`,
    `- 산출물 형식: ${input.outputFormat || '요약 -> 세부 -> 검증 순서'}`,
  ].join('\n');
}

function buildPhase(role: Role): string {
  const sections = ROLE_SECTIONS[role].map((section) => `- ${section} 기준을 먼저 고정`).join('\n');
  return sections;
}

function buildCriteria(role: Role): string {
  const common = [
    '- 출력은 바로 실행 가능한 수준으로 작성',
    '- 누락 가능성이 높은 예외/경계 조건 포함',
    '- 최종 결과에 검증 방법을 반드시 포함',
  ];

  const roleSpecific: Record<Role, string[]> = {
    planner: ['- 의사결정 근거와 우선순위를 함께 명시'],
    designer: ['- 접근성, 반응형, 상태 UI를 별도 항목으로 분리'],
    developer: ['- 타입 안전성과 보안 관점의 체크포인트를 분리'],
  };

  return [...common, ...roleSpecific[role]].join('\n');
}

function buildAvoidList(role: Role): string {
  const shared = ['- 모호한 지시어만 나열하고 실행 기준을 누락하지 않기', '- 요청 키워드를 description에서 누락하지 않기'];
  const roleAvoid: Record<Role, string[]> = {
    planner: ['- 수용 기준 없이 기능 목록만 나열하지 않기'],
    designer: ['- 상태 UI 없이 정상 상태 화면만 설계하지 않기'],
    developer: ['- 테스트/검증 항목 없이 코드만 제안하지 않기'],
  };
  return [...shared, ...roleAvoid[role]].join('\n');
}

export function generateSkillMd(input: SkillInput, role: Role): string {
  const description = buildSkillDescription(input, role);

  return `---
name: ${input.name}
description: ${description}
---

# ${input.name}

## 작업 프로세스

### 0. 먼저 확인할 입력
${buildChecklist(role, input)}

### 1. ${ROLE_PHASE_TITLE[role]}
${buildPhase(role)}

### 2. 구현 기준
${buildCriteria(role)}

### 3. 절대 피하기
${buildAvoidList(role)}

## 출력 포맷
${input.outputFormat || '1) 요약 2) 세부 실행안 3) 검증 체크리스트'}
`;
}
