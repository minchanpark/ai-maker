import type {
  AutomationLevel,
  CollaborationMode,
  FocusArea,
  HookEvent,
  PermissionMode,
} from '@/types';

export const FOCUS_AREA_OPTIONS: { value: FocusArea; label: string; desc: string }[] = [
  {
    value: 'planning',
    label: '기획/전략',
    desc: '요구사항 정리, 우선순위, 실행 계획 중심',
  },
  {
    value: 'design',
    label: '경험/디자인',
    desc: 'UI/UX 방향, 상태 설계, 사용자 흐름 중심',
  },
  {
    value: 'development',
    label: '구현/개발',
    desc: '코드 구현, 품질 관리, 배포 준비 중심',
  },
];

export const COLLABORATION_MODE_OPTIONS: { value: CollaborationMode; label: string; desc: string }[] = [
  {
    value: 'balanced',
    label: '균형형',
    desc: '속도와 안정성을 균형 있게 유지',
  },
  {
    value: 'speed',
    label: '속도형',
    desc: '초안 작성과 반복 개선 속도 우선',
  },
  {
    value: 'safe',
    label: '안전형',
    desc: '검증과 실수 방지를 우선',
  },
];

export const AUTOMATION_LEVEL_OPTIONS: { value: AutomationLevel; label: string; desc: string }[] = [
  {
    value: 'minimal',
    label: '최소 자동화',
    desc: '필수 훅만 사용',
  },
  {
    value: 'recommended',
    label: '권장 자동화',
    desc: '일반적인 자동화 규칙 적용',
  },
  {
    value: 'aggressive',
    label: '강화 자동화',
    desc: '검증/보조 자동화를 적극 적용',
  },
];

export const PERMISSION_OPTIONS: PermissionMode[] = ['plan', 'default', 'acceptEdits'];

export const TOOL_OPTIONS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'] as const;

export const PERMISSION_DEFAULT_TOOLS: Record<PermissionMode, string[]> = {
  plan: ['Read', 'Grep', 'Glob'],
  default: ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
  acceptEdits: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
};

export const HOOK_EVENT_OPTIONS: HookEvent[] = [
  'PreToolUse',
  'PostToolUse',
  'SessionStart',
  'Stop',
  'Notification',
];
