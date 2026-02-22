import type { ProjectInput } from '@/types';

export const baseInput: ProjectInput = {
  projectName: '아이디어허브',
  ideaSummary: '초기 아이디어를 빠르게 구조화하고 실행 계획으로 전환하는 협업 도구',
  targetUsers: '예비 창업자와 초기 PM',
  problemStatement: '아이디어는 많은데 무엇부터 실행할지 정리되지 않아 팀 의사결정이 지연된다.',
  coreFeatures: ['아이디어 요약 자동화', '실행 우선순위 제안', '검증 체크리스트 생성'],
  successCriteria: '아이디어를 24시간 안에 실행 가능한 계획으로 전환',
  nonNegotiables: ['.env 수정 금지', '개인정보 외부 전송 금지'],
  focusAreas: ['planning', 'design', 'development'],
  collaborationMode: 'balanced',
  automationLevel: 'recommended',
};
