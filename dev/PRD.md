# Claude Code 커스텀 도구 생성기 — PRD (Product Requirements Document)

> **이 문서는 AI 에이전트가 바이브 코딩으로 웹 서비스를 구현하기 위한 필수 지침서입니다.**
> 구현 시작 전 이 문서 전체를 반드시 숙지하고, `AI_INSTRUCTIONS.md`와 `REFERENCE.md`도 함께 읽으세요.

---

## 0. 개정 메모 (아이디어 중심 UX, 2026-02-21)

- 입력 UX를 다단계 설정형에서 **아이디어 중심 단일 폼**으로 단순화한다.
- 사용자는 기술 스택/세부 Skill/Hook/Agent 스펙을 직접 작성하지 않는다.
- 입력값: 프로젝트 아이디어, 대상 사용자, 문제 정의, 핵심 기능, 성공 기준, 절대 조건, 중점 영역.
- 시스템이 입력 맥락을 바탕으로 필요한 Skill/Hook/Agent를 자동 설계/생성한다.
- Step 3 AI 대화형 개선은 Phase 2로 유지한다.

---

## 1. 제품 개요

### 1.1 제품명
**Claude Code 커스텀 도구 생성기** (Skills · Hooks · Sub-Agents Generator)

### 1.2 한 줄 설명
기획자 / 디자이너 / 개발자가 팀 아이디어를 입력하면 직무별 맞춤형 Claude Code Skill, Hook, SubAgent MD 파일을 자동으로 생성해주고, AI와 실시간 대화로 개선까지 할 수 있는 웹 서비스.

### 1.3 핵심 가치
- 비개발자도 Claude Code 워크플로우를 커스터마이징할 수 있게 한다.
- 3직무(기획자/디자이너/개발자) 각각에 최적화된 파일을 즉시 생성한다.
- 생성 후 AI와 대화하며 파일을 실시간으로 개선한다.

---

## 2. 전체 플로우 (3단계)

```
[Step 1: 정보 수집]
  사용자가 프로젝트 정보 + 직무 선택 + Skill/Hook/Agent 설정을 폼으로 입력

        ↓

[Step 2: 파일 생성 & 다운로드]
  입력 정보 기반으로 직무별 맞춤 SKILL.md / settings.json / Hook 스크립트 / Agent MD 생성
  ZIP 다운로드 제공

        ↓

[Step 3: AI 대화형 개선]
  "AI와 대화하며 개선하기" 버튼 클릭 →
  생성된 파일을 컨텍스트로 AI 채팅 시작 →
  대화하면서 파일 실시간 업데이트 + diff 뷰 제공
```

---

## 3. 기능 요구사항

### 3.1 Step 1 — 정보 수집 폼

#### 공통 입력 필드 (모든 직무)
| 필드명 | 타입 | 설명 | 필수 |
|--------|------|------|------|
| 프로젝트 이름 | text | 예: "SOI", "Task Manager" | ✅ |
| 프로젝트 설명 | textarea | 무엇을 만드는지, 타겟 유저 | ✅ |
| 기술 스택 | multi-select | React, Next.js, Vue, TypeScript, Tailwind, CSS 등 | ✅ |
| 직무 선택 | radio | 기획자 / 디자이너 / 개발자 | ✅ |

#### Skill 설정 입력 필드
| 필드명 | 타입 | 예시 | 필수 |
|--------|------|------|------|
| Skill 이름 | text | "frontend-design", "requirement-analyzer" | ✅ |
| Skill 설명 | textarea | 언제, 무엇을, 어떻게 사용하는지 | ✅ |
| 트리거 키워드 | tag-input | "UI", "React", "컴포넌트", "디자인" | ✅ |
| 품질 기준 | tag-input | "클리셰 회피", "접근성 고려", "로딩 상태 포함" | 선택 |
| 출력 포맷 | textarea | 레이아웃 스펙 → 코드 → 토큰 순서 등 | 선택 |

#### Hook 설정 입력 필드
| 필드명 | 타입 | 예시 | 필수 |
|--------|------|------|------|
| Hook 이벤트 | multi-select | PreToolUse, PostToolUse, SessionStart, Stop, Notification | ✅ |
| 적용 대상 확장자 | tag-input | .ts, .tsx, .css, .scss | ✅ |
| 실행 도구 | multi-select | prettier, eslint, stylelint, storybook | ✅ |
| 보호할 파일 경로 | tag-input | .env, package-lock.json, yarn.lock | 선택 |

#### SubAgent 설정 입력 필드
| 필드명 | 타입 | 예시 | 필수 |
|--------|------|------|------|
| Agent 이름 | text | "ui-designer", "code-reviewer" | ✅ |
| Agent 역할 설명 | textarea | 무엇을 하는 에이전트인지 | ✅ |
| 권한 모드 | select | plan (읽기전용) / default (제안) / acceptEdits (실행) | ✅ |
| 사용 가능 도구 | multi-select | Read, Write, Edit, Bash, Grep, Glob | ✅ |
| 메모리 사용 | checkbox | project 메모리 활성화 여부 | 선택 |

#### UX 요구사항
- **단계별 폼**: 공통 정보(Step 1) → Skill 설정(Step 2) → Hook 설정(Step 3) → Agent 설정(Step 4) → 직무 선택 & 생성(Step 5)
- 각 입력 필드에 **도움말 툴팁** 제공 (예: "Skill 이름은 소문자와 하이픈만 사용하세요")
- **직무별 예시 템플릿** 버튼 제공 — 클릭하면 해당 직무 기본값으로 폼 자동 채우기
- 실시간 입력 검증 (필수 필드, Skill 이름 소문자-하이픈 형식 등)
- 진행 표시줄 (Step N / 5)

---

### 3.2 Step 2 — 파일 생성 & 다운로드

#### 직무별 생성 파일 목록

**기획자 (Planner)**
```
generated-files/
├── skills/
│   └── requirement-analyzer/
│       └── SKILL.md
├── hooks/
│   ├── settings.json
│   └── scripts/
│       └── session_start.sh
└── agents/
    └── requirement-reviewer.md
```

**디자이너 (Designer)**
```
generated-files/
├── skills/
│   └── frontend-design/
│       └── SKILL.md
├── hooks/
│   ├── settings.json
│   └── scripts/
│       ├── format_code.sh
│       └── create_storybook.py
└── agents/
    ├── ui-designer.md
    └── design-system-keeper.md
```

**개발자 (Developer)**
```
generated-files/
├── skills/
│   └── code-quality/
│       └── SKILL.md
├── hooks/
│   ├── settings.json
│   └── scripts/
│       ├── format_code.sh
│       ├── lint_code.sh
│       └── protect_paths.py
└── agents/
    ├── frontend-implementer.md
    └── a11y-auditor.md
```

#### 파일 내용 생성 규칙

**SKILL.md 필수 구조:**
```yaml
---
name: [소문자-하이픈만]
description: [트리거 키워드 + 사용 케이스 + 품질 기준 — 최소 150자 이상]
---

# [Skill 이름]

## 작업 프로세스

### 0. 먼저 확인할 입력
[목적/유저, 스택/제약, 산출물 형태]

### 1. 코드 작성 전: 컨셉/방향 설정
[직무별 맞춤 설정 기준]

### 2. 구현 기준
[직무별 맞춤 구현 기준]

### 3. 절대 피하기
[직무별 금지 사항]

## 출력 포맷
[사용자가 원하는 출력 순서 및 형식]
```

**settings.json 필수 구조:**
```json
{
  "hooks": {
    "PreToolUse": [...],
    "PostToolUse": [...],
    "SessionStart": [...]
  }
}
```
- 반드시 유효한 JSON 문법 (마지막 쉼표 없음)
- timeout 값: format/lint = 60, test = 120, protect = 10, storybook = 30

**Hook 스크립트 필수 조건:**
- Bash: `#!/bin/bash` + `set -euo pipefail` + 에러 처리 (`|| true`)
- Python: `#!/usr/bin/env python3` + json stdin 파싱
- 파일 경로는 `$CLAUDE_PROJECT_DIR` 변수 사용

**SubAgent MD 필수 구조:**
```yaml
---
name: [agent-name]
description: [역할 + 트리거 상황 — 최소 100자]
model: inherit
permissionMode: [plan|default|acceptEdits]
tools: [최소 권한 원칙 적용]
---

# Role
[명확한 역할 정의]

# Workflow
[단계별 작업 프로세스]

# Output format
[산출물 형식]

# Constraints
[하지 말아야 할 것]
```

#### 다운로드 기능
- **ZIP 전체 다운로드** 버튼 (JSZip 사용)
- **개별 파일 다운로드** 링크
- ZIP에 `README.md` 포함 (설치 위치 안내 + chmod 명령어 + 검증 체크리스트)

#### README.md 내용 (ZIP 포함)
```markdown
# Claude Code 커스텀 도구 설치 가이드

## 1. 파일 배치
프로젝트 루트에서:
- skills/ → .claude/skills/
- hooks/ → .claude/hooks/
- agents/ → .claude/agents/
- hooks/settings.json → .claude/settings.json

## 2. 실행 권한 부여
chmod +x .claude/hooks/*.sh .claude/hooks/*.py

## 3. 검증
- Skills: Claude Code에서 "[트리거 키워드] 도와줘" 입력
- Hooks: jq . .claude/settings.json (JSON 문법 확인)
- Agents: Claude Code에서 /agents 입력
```

---

### 3.3 Step 3 — AI 대화형 개선

#### UI 레이아웃
```
┌──────────────────────────────────────────────────────────┐
│  📁 생성된 파일 목록 (탭 또는 사이드바)                    │
│  [✓] SKILL.md  [✓] settings.json  [✓] ui-designer.md    │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────┬───────────────────────────────┐
│  📄 파일 내용 뷰어         │  💬 AI 채팅                  │
│  (Monaco Editor)         │  "description을 더 구체적     │
│  실시간 업데이트           │   으로 만들어줘"              │
│  변경 부분 하이라이트       │                              │
│  (diff 강조)              │  [전송] 버튼                  │
└──────────────────────────┴───────────────────────────────┘
```

#### 기능 상세
1. "AI와 대화하며 개선하기" 버튼 클릭 → 채팅 UI 진입
2. 사용자가 수정 요청 입력 → AI가 해당 파일 전체 내용을 수정해서 응답
3. AI 응답에서 코드 블록 자동 파싱 → 파일 내용 실시간 교체
4. 변경된 부분 diff 하이라이트 (이전 내용 빨강, 새 내용 초록)
5. 수정된 파일 재다운로드 버튼 항상 노출
6. Undo 버튼 (이전 버전으로 되돌리기)

#### AI 프롬프트 구조 (백엔드에서 사용)
```
당신은 Claude Code의 Skills, Hooks, SubAgents 전문가입니다.

## 현재 파일
[파일명]: [현재 전체 내용]

## 프로젝트 컨텍스트
- 프로젝트: [프로젝트명]
- 직무: [기획자|디자이너|개발자]
- 기술 스택: [스택 목록]

## 사용자 요청
[사용자 입력]

## 수정 규칙
1. YAML frontmatter 문법 준수 (마지막 쉼표 없음)
2. description은 트리거 키워드 반드시 유지
3. 직무별 맞춤 내용 보존
4. 사용자가 명시한 부분만 수정
5. 수정된 파일 전체 내용을 코드 블록으로 출력

## 출력 형식
수정된 파일 전체를 아래 형식으로 출력:
\`\`\`[언어]
[전체 파일 내용]
\`\`\`

변경 사항 요약 (1-3줄):
- 수정 위치: ...
- 수정 내용: ...
- 수정 이유: ...
```

#### 파싱 로직
- AI 응답에서 첫 번째 코드 블록(```` ```yaml ``` ```` 또는 ```` ```markdown ``` ```` 등) 추출
- 파일 내용 교체 전 YAML frontmatter 유효성 검사
- 변경 사항 diff 계산 (라인 단위)
- 애니메이션과 함께 뷰어 업데이트

---

## 4. 기술 스택

### 프론트엔드
- **Framework**: Next.js 14 (App Router)
- **UI**: Tailwind CSS + shadcn/ui
- **폼 관리**: React Hook Form + Zod
- **상태 관리**: Zustand
- **코드 에디터**: Monaco Editor
- **Diff 뷰어**: react-diff-viewer-continued
- **ZIP 생성**: JSZip

### 백엔드 / AI
- **AI API**: Anthropic Claude API (`claude-sonnet-4-5` 또는 최신 모델)
- **API Route**: Next.js API Routes (Streaming 지원)
- **환경변수**: `ANTHROPIC_API_KEY`

### 배포
- **호스팅**: Vercel
- **환경변수 관리**: Vercel Environment Variables

---

## 5. 데이터 모델

```typescript
// 사용자 입력 전체
interface ProjectInput {
  projectName: string;
  projectDescription: string;
  techStack: string[];
  role: 'planner' | 'designer' | 'developer';

  skill: {
    name: string;          // 소문자-하이픈
    description: string;   // 150자 이상
    triggerKeywords: string[];
    qualityCriteria: string[];
    outputFormat: string;
  };

  hooks: {
    events: ('PreToolUse' | 'PostToolUse' | 'SessionStart' | 'Stop' | 'Notification')[];
    targetExtensions: string[];
    tools: string[];           // prettier, eslint, stylelint, storybook
    protectedPaths: string[];
  };

  agents: {
    name: string;
    roleDescription: string;
    permissionMode: 'plan' | 'default' | 'acceptEdits';
    tools: string[];
    useMemory: boolean;
  }[];
}

// 생성된 파일
interface GeneratedFile {
  path: string;
  content: string;
  type: 'skill' | 'hook-config' | 'hook-script' | 'agent';
  language: 'markdown' | 'json' | 'bash' | 'python';
}

interface GeneratedPackage {
  files: GeneratedFile[];
  readme: string;
  projectInput: ProjectInput;  // 재생성/AI 개선에 활용
}

// AI 대화 세션
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  fileUpdates?: {
    path: string;
    before: string;
    after: string;
  }[];
}
```

---

## 6. 직무별 기본 템플릿 (예시 채우기용)

### 기획자 템플릿
```json
{
  "role": "planner",
  "skill": {
    "name": "requirement-analyzer",
    "triggerKeywords": ["요구사항", "분석", "문서화", "기획", "PRD"],
    "qualityCriteria": ["우선순위 기준 명시", "수용 기준 포함", "이해관계자 영향 분석"]
  },
  "hooks": {
    "events": ["SessionStart"],
    "tools": []
  },
  "agents": [
    { "name": "requirement-reviewer", "permissionMode": "plan" }
  ]
}
```

### 디자이너 템플릿
```json
{
  "role": "designer",
  "skill": {
    "name": "frontend-design",
    "triggerKeywords": ["UI", "디자인", "컴포넌트", "React", "Tailwind", "프론트엔드"],
    "qualityCriteria": ["클리셰 회피", "loading/empty/error 상태", "접근성 고려", "8pt 그리드"]
  },
  "hooks": {
    "events": ["PostToolUse"],
    "tools": ["prettier", "storybook"],
    "targetExtensions": [".ts", ".tsx", ".css"]
  },
  "agents": [
    { "name": "ui-designer", "permissionMode": "plan" },
    { "name": "design-system-keeper", "permissionMode": "default", "useMemory": true }
  ]
}
```

### 개발자 템플릿
```json
{
  "role": "developer",
  "skill": {
    "name": "code-quality",
    "triggerKeywords": ["코드", "리뷰", "테스트", "TypeScript", "품질", "리팩토링"],
    "qualityCriteria": ["타입 안전성", "테스트 커버리지", "보안 취약점 방지"]
  },
  "hooks": {
    "events": ["PreToolUse", "PostToolUse"],
    "tools": ["prettier", "eslint"],
    "protectedPaths": [".env", "package-lock.json", "yarn.lock"]
  },
  "agents": [
    { "name": "frontend-implementer", "permissionMode": "acceptEdits" },
    { "name": "a11y-auditor", "permissionMode": "plan" }
  ]
}
```

---

## 7. 개발 우선순위

### Phase 1 (MVP — 핵심 기능)
1. 입력 폼 UI (공통 + 직무별)
2. 파일 생성 로직 (3직무 × 템플릿)
3. ZIP 다운로드

### Phase 2 (AI 개선)
4. AI 대화형 개선 UI
5. 파일 실시간 업데이트
6. Diff 뷰어

### Phase 3 (폴리싱)
7. 직무별 예시 템플릿 자동 채우기
8. 수정 이력 (Undo/Redo)
9. 모바일 반응형 완성

---

## 8. 성공 기준

- [ ] 3직무 시나리오 각각 파일 생성 성공
- [ ] 생성된 JSON 문법 오류 0%
- [ ] Skill description 평균 150자 이상
- [ ] AI 대화로 파일 수정 성공률 95%+
- [ ] 폼 작성 시간 5분 이내
- [ ] 파일 생성 ~ 다운로드 10초 이내
- [ ] 모바일 반응형 지원

---

## 9. 참고 문서 (필수 읽기)

구현 전 반드시 아래 문서들을 참고하세요:

- **Skills 가이드**: https://thirsty-girdle-b0f.notion.site/Skills-3006cd041f7f802087f3ff1984e3be09
- **Hooks 가이드**: https://thirsty-girdle-b0f.notion.site/Hooks-3006cd041f7f80d6aa45e95c2ee75f85
- **SubAgents 가이드**: https://thirsty-girdle-b0f.notion.site/SubAgents-2fd6cd041f7f81969dccc8452c890265
- **검증 가이드**: https://thirsty-girdle-b0f.notion.site/Skills-Hooks-Sub-Agents-30c6cd041f7f81778587fcb0d71c55dc

> 검증 가이드의 실제 파일 예시들을 생성 로직의 기준으로 삼으세요. 특히 SKILL.md, settings.json, Hook 스크립트, Agent MD의 구체적인 예시 코드가 포함되어 있습니다.
