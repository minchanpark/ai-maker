# AI 에이전트 지침서 — Claude Code 커스텀 도구 생성기

> **이 문서는 바이브 코딩으로 웹 서비스를 구현하는 AI 에이전트를 위한 지침서입니다.**
> PRD.md를 먼저 읽은 후 이 지침서를 따르세요.

---

## 개정 메모 (아이디어 중심 UX, 2026-02-21)

- 입력 흐름은 다단계 폼이 아니라 **단일 아이디어 폼**을 우선한다.
- 기술 스택/세부 스크립트/에이전트 설정을 사용자에게 강요하지 않는다.
- 사용자 입력은 프로젝트 아이디어와 사용자 문제 중심으로 수집한다.
- Skill/Hook/Agent는 입력 맥락 기반으로 백엔드에서 자동 파생한다.
- Phase 1 범위는 자동 생성 + 결과 다운로드까지이며, AI 채팅 개선은 Phase 2로 유지한다.

---

## 0. 시작 전 체크리스트

구현을 시작하기 전, 다음 사항을 반드시 확인하세요:

- [ ] `PRD.md` 전체를 읽었는가?
- [ ] 검증 가이드 문서의 실제 파일 예시(SKILL.md, settings.json, 스크립트, Agent MD)를 숙지했는가?
- [ ] Next.js 14 + Tailwind + shadcn/ui + Zustand + React Hook Form + Monaco Editor + JSZip 의존성을 설치했는가?
- [ ] `ANTHROPIC_API_KEY` 환경변수를 설정했는가?

---

## 1. 프로젝트 구조 (반드시 이 구조로 구현)

```
/
├── app/
│   ├── page.tsx                    # 랜딩 / Step 1 시작점
│   ├── generate/
│   │   └── page.tsx               # Step 1-4: 정보 수집 폼
│   ├── result/
│   │   └── page.tsx               # Step 2: 생성 결과 + 다운로드
│   ├── chat/
│   │   └── page.tsx               # Step 3: AI 대화형 개선
│   └── api/
│       ├── generate/
│       │   └── route.ts           # 파일 생성 API
│       └── chat/
│           └── route.ts           # AI 대화 API (Streaming)
├── components/
│   ├── form/
│   │   ├── ProjectInfoForm.tsx     # 공통 정보 폼
│   │   ├── SkillForm.tsx          # Skill 설정 폼
│   │   ├── HookForm.tsx           # Hook 설정 폼
│   │   ├── AgentForm.tsx          # Agent 설정 폼
│   │   └── RoleSelector.tsx       # 직무 선택
│   ├── result/
│   │   ├── FileViewer.tsx         # 파일 내용 뷰어 (Monaco)
│   │   ├── FileList.tsx           # 생성된 파일 목록
│   │   └── DownloadButton.tsx     # ZIP 다운로드
│   └── chat/
│       ├── ChatPanel.tsx          # AI 채팅 패널
│       ├── DiffViewer.tsx         # Diff 뷰어
│       └── ChatMessage.tsx        # 메시지 컴포넌트
├── lib/
│   ├── generators/
│   │   ├── skillGenerator.ts      # SKILL.md 생성 로직
│   │   ├── hookGenerator.ts       # settings.json + 스크립트 생성
│   │   ├── agentGenerator.ts      # Agent MD 생성 로직
│   │   └── readmeGenerator.ts     # README.md 생성
│   ├── templates/
│   │   ├── planner.ts             # 기획자 기본 템플릿
│   │   ├── designer.ts            # 디자이너 기본 템플릿
│   │   └── developer.ts          # 개발자 기본 템플릿
│   ├── zipBuilder.ts              # ZIP 파일 생성
│   └── aiPrompts.ts               # AI 프롬프트 템플릿
├── store/
│   └── generatorStore.ts          # Zustand 전역 상태
└── types/
    └── index.ts                   # TypeScript 타입 정의
```

---

## 2. 파일 생성 로직 상세 지침

### 2.1 SKILL.md 생성 (`lib/generators/skillGenerator.ts`)

```typescript
// 반드시 이 규칙을 따를 것
const SKILL_RULES = {
  // 1. name: 소문자와 하이픈만 허용
  nameFormat: /^[a-z][a-z0-9-]*$/,
  
  // 2. description: 최소 150자, 트리거 키워드 포함 필수
  minDescriptionLength: 150,
  
  // 3. 직무별 필수 섹션
  sections: {
    planner: ['요구사항 분석', '우선순위 기준', '수용 기준', '이해관계자'],
    designer: ['컨셉 방향', '타이포그래피', '색상 팔레트', 'loading/empty/error'],
    developer: ['코드 품질', '타입 안전성', '테스트', '보안'],
  }
};

// 생성 함수 — 반드시 이 구조로
function generateSkillMd(input: SkillInput, role: Role): string {
  return `---
name: ${input.name}
description: ${buildDescription(input, role)}
---

# ${formatTitle(input.name)}

## 작업 프로세스

### 0. 먼저 확인할 입력
${buildInputChecklist(role, input)}

### 1. ${getPhase1Title(role)}
${buildPhase1(role, input)}

### 2. 구현 기준
${buildCriteria(role, input)}

### 3. 절대 피하기
${buildAvoidList(role, input)}

## 출력 포맷
${buildOutputFormat(input)}
`;
}

// description 빌더 — 트리거 키워드 + 사용 케이스 + 품질 기준 + 직무 맥락
function buildDescription(input: SkillInput, role: Role): string {
  const keywords = input.triggerKeywords.join('/');
  const criteria = input.qualityCriteria.join(', ');
  // 반드시 150자 이상 생성
  return `[생성된 설명 — ${keywords} 관련 작업 시 사용. ${input.description}. ${criteria} 기준 적용.`;
}
```

**직무별 description 예시 (최소 이 수준의 품질로 생성):**

기획자:
```
요구사항 분석/문서화/PRD/기획/검토 작업 시 사용합니다. 사용자 스토리와 수용 기준을 포함한 구조화된 요구사항을 작성하고, 우선순위 MoSCoW 기준을 적용하며, 이해관계자 영향 분석과 함께 명확한 Definition of Done을 정의합니다. 모호한 요구사항은 반드시 질문으로 명확히 하고, 기술적 제약사항도 함께 문서화합니다.
```

디자이너:
```
프로덕션 수준의 프론트엔드 UI/UX 디자인 산출물을 생성합니다. 웹 컴포넌트/페이지/랜딩/대시보드/React 컴포넌트/HTML·CSS 레이아웃·스타일링 작업에 사용합니다. 일반적인 AI 미학(클리셰 폰트/그라디언트/쿠키커터 레이아웃)을 피하고, 의도적인 컨셉과 타이포/컬러/레이아웃 디테일을 갖춘 세련된 UI를 제공합니다. 톤은 미니멀/에디토리얼/브루탈리스트/파스텔/산업적 중 하나로 명확히 선택하고 일관되게 유지합니다.
```

개발자:
```
코드 품질/리뷰/테스트/리팩토링/TypeScript 작업 시 사용합니다. strict 타입 안전성, 단위/통합 테스트 커버리지, 보안 취약점 방지(XSS/CSRF/인젝션), 성능 최적화(번들 크기/렌더링)를 기준으로 코드를 작성하고 검토합니다. 기술 부채를 명시하고 마이그레이션 경로를 제안합니다.
```

---

### 2.2 Hook 파일 생성 (`lib/generators/hookGenerator.ts`)

**settings.json 생성 규칙:**
```typescript
function generateSettingsJson(hookInput: HookInput, role: Role): string {
  const hooks: any = {};
  
  // PreToolUse — 파일 보호 (개발자만)
  if (hookInput.events.includes('PreToolUse') && hookInput.protectedPaths.length > 0) {
    hooks.PreToolUse = [{
      matcher: "Edit|Write",
      hooks: [{
        type: "command",
        command: `python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/protect_paths.py`,
        timeout: 10
      }]
    }];
  }
  
  // PostToolUse — 포맷/린트/스토리북
  if (hookInput.events.includes('PostToolUse')) {
    const postHooks = [];
    if (hookInput.tools.includes('prettier')) {
      postHooks.push({
        type: "command",
        command: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/format_code.sh`,
        timeout: 60
      });
    }
    if (hookInput.tools.includes('eslint')) {
      postHooks.push({
        type: "command",
        command: `"$CLAUDE_PROJECT_DIR"/.claude/hooks/lint_code.sh`,
        timeout: 60
      });
    }
    if (postHooks.length > 0) {
      hooks.PostToolUse = [{
        matcher: "Edit|Write",
        hooks: postHooks
      }];
    }
    
    // Storybook은 Write에만
    if (hookInput.tools.includes('storybook')) {
      const existing = hooks.PostToolUse || [];
      existing.push({
        matcher: "Write",
        hooks: [{
          type: "command",
          command: `python3 "$CLAUDE_PROJECT_DIR"/.claude/hooks/create_storybook.py`,
          timeout: 30
        }]
      });
      hooks.PostToolUse = existing;
    }
  }
  
  // JSON.stringify로 생성 후 마지막 쉼표 없는지 반드시 확인
  return JSON.stringify({ hooks }, null, 2);
}
```

**스크립트 파일 생성 — 반드시 이 포맷:**

`format_code.sh`:
```bash
#!/bin/bash
set -euo pipefail
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx|*.css|*.scss|*.md)
    npx --yes prettier --write "$FILE_PATH" >/dev/null 2>&1 || true
    ;;
esac
exit 0
```

`lint_code.sh`:
```bash
#!/bin/bash
set -euo pipefail
FILE_PATH=$(cat | jq -r '.tool_input.file_path // empty')
case "$FILE_PATH" in
  *.ts|*.tsx|*.js|*.jsx)
    npx --yes eslint --fix "$FILE_PATH" >/dev/null 2>&1 || true
    ;;
esac
exit 0
```

`protect_paths.py` (보호 경로를 사용자 입력에서 동적으로 생성):
```python
#!/usr/bin/env python3
import json
import sys

data = json.load(sys.stdin)
path = (data.get('tool_input') or {}).get('file_path') or ''

BLOCK_PATHS = [${사용자가 입력한 protectedPaths를 배열로}]

if any(blocked in path for blocked in BLOCK_PATHS):
    print(f'❌ 보호된 파일 편집 차단: {path}', file=sys.stderr)
    print('사용자가 직접 편집해야 합니다.', file=sys.stderr)
    sys.exit(2)

sys.exit(0)
```

`create_storybook.py`:
```python
#!/usr/bin/env python3
import json
import sys
import os
import re

data = json.load(sys.stdin)
file_path = (data.get('tool_input') or {}).get('file_path') or ''

if not re.search(r'\.(tsx|jsx)$', file_path) or '.stories.' in file_path:
    sys.exit(0)

component_name = os.path.basename(file_path).replace('.tsx', '').replace('.jsx', '')
story_path = file_path.replace('.tsx', '.stories.tsx').replace('.jsx', '.stories.jsx')

if os.path.exists(story_path):
    sys.exit(0)

story_template = f"""import type {{ Meta, StoryObj }} from '@storybook/react';
import {{ {component_name} }} from './{component_name}';

const meta: Meta<typeof {component_name}> = {{
  title: 'Components/{component_name}',
  component: {component_name},
  tags: ['autodocs'],
}};

export default meta;
type Story = StoryObj<typeof {component_name}>;

export const Default: Story = {{
  args: {{}},
}};
"""

with open(story_path, 'w') as f:
    f.write(story_template)

print(f'✅ Storybook 파일 생성: {story_path}')
sys.exit(0)
```

---

### 2.3 SubAgent MD 생성 (`lib/generators/agentGenerator.ts`)

**permissionMode 결정 규칙:**
```typescript
const PERMISSION_RULES = {
  // plan: 읽기 전용 — 분석/검토/검사 역할
  plan: {
    roles: ['reviewer', 'auditor', 'analyzer', 'checker'],
    tools: ['Read', 'Grep', 'Glob'],
  },
  // default: 제안만 — 설계/기획 역할
  default: {
    roles: ['designer', 'keeper', 'planner'],
    tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
  },
  // acceptEdits: 실행 권한 — 구현 역할
  acceptEdits: {
    roles: ['implementer', 'developer', 'builder'],
    tools: ['Read', 'Grep', 'Glob', 'Edit', 'Write', 'Bash'],
  },
};
```

**직무별 Agent 매핑:**

기획자 기본 Agent:
- `requirement-reviewer` (plan) — 요구사항 검토
- `requirement-analyzer` (default) — 요구사항 분석 및 문서화

디자이너 기본 Agent:
- `ui-designer` (plan) — UI 스펙 정의 (코드 없이)
- `design-system-keeper` (default, memory: project) — 디자인 시스템 유지
- `ui-reviewer` (plan) — 최종 UI 품질 리뷰

개발자 기본 Agent:
- `frontend-implementer` (acceptEdits) — 실제 코드 구현
- `a11y-auditor` (plan) — 접근성 검사

**Agent MD 생성 예시 (ui-designer 수준의 품질 필수):**
```markdown
---
name: ui-designer
description: 프론트엔드 UI 설계/비주얼 방향/컴포넌트 스펙을 정의합니다. 화면 구조, 레이아웃, 타이포, 컬러, 상태(loading/empty/error), 반응형, 인터랙션까지 포함한 "구현 가능한 스펙"을 작성할 때 사용합니다.
model: inherit
permissionMode: plan
tools: Read, Grep, Glob
---

# Role
You are a UI Designer for a frontend product.

# Goal
When invoked, produce implementable UI specs:
- Information architecture (sections, hierarchy)
- Layout rules (grid, spacing, responsive breakpoints)
- Typography & color tokens (names + usage)
- Component inventory (what components exist, props, states)
- Interaction spec (hover/focus/active, keyboard flows)
- Edge states (loading/empty/error/permission)
- Accessibility notes

# Output format (always)
1) **UI Summary** (1 paragraph)
2) **Layout & Responsive** (bullets)
3) **Components & States** (table)
4) **Design Tokens** (names)
5) **Interaction & A11y** (bullets)
6) **Implementation Notes**

# Constraints
- Don't write code unless explicitly asked.
- Everything must be implementable.
- List assumptions explicitly if requirements are missing.
```

---

## 3. API Route 구현 지침

### 3.1 파일 생성 API (`app/api/generate/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { generateSkillMd } from '@/lib/generators/skillGenerator';
import { generateHookFiles } from '@/lib/generators/hookGenerator';
import { generateAgentMd } from '@/lib/generators/agentGenerator';
import { generateReadme } from '@/lib/generators/readmeGenerator';

export async function POST(req: NextRequest) {
  const input = await req.json();
  
  // 입력 유효성 검사
  if (!input.projectName || !input.role) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }
  
  const files = [];
  
  // Skill 생성
  files.push({
    path: `skills/${input.skill.name}/SKILL.md`,
    content: generateSkillMd(input.skill, input.role),
    type: 'skill',
    language: 'markdown',
  });
  
  // Hook 파일 생성
  const hookFiles = generateHookFiles(input.hooks, input.role);
  files.push(...hookFiles);
  
  // Agent 파일 생성
  for (const agent of input.agents) {
    files.push({
      path: `agents/${agent.name}.md`,
      content: generateAgentMd(agent, input),
      type: 'agent',
      language: 'markdown',
    });
  }
  
  // README 생성
  const readme = generateReadme(input, files);
  
  return NextResponse.json({ files, readme });
}
```

### 3.2 AI 대화 API (`app/api/chat/route.ts`)

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const { message, currentFiles, projectContext } = await req.json();
  
  // 시스템 프롬프트 구성
  const systemPrompt = buildChatSystemPrompt(currentFiles, projectContext);
  
  // Streaming 응답
  const stream = client.messages.stream({
    model: 'claude-sonnet-4-5',
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: message }],
  });
  
  // ReadableStream으로 변환하여 클라이언트에 전달
  const readableStream = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          controller.enqueue(new TextEncoder().encode(chunk.delta.text));
        }
      }
      controller.close();
    },
  });
  
  return new Response(readableStream, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}

function buildChatSystemPrompt(currentFiles: GeneratedFile[], projectContext: any): string {
  const filesContext = currentFiles
    .map(f => `### ${f.path}\n\`\`\`${f.language}\n${f.content}\n\`\`\``)
    .join('\n\n');
    
  return `당신은 Claude Code의 Skills, Hooks, SubAgents 전문가입니다.

## 현재 파일들
${filesContext}

## 프로젝트 컨텍스트
- 프로젝트: ${projectContext.projectName}
- 직무: ${projectContext.role}
- 기술 스택: ${projectContext.techStack.join(', ')}

## 수정 규칙
1. YAML frontmatter 문법 준수 (마지막 쉼표 없음)
2. description은 트리거 키워드 반드시 유지
3. 직무별 맞춤 내용 보존
4. 사용자가 명시한 부분만 수정
5. 수정된 파일 전체 내용을 \`\`\`언어 코드블록으로 출력

## 응답 형식
수정된 파일 전체를 코드 블록으로 출력한 뒤:
- 수정 위치: ...
- 수정 내용: ...
- 수정 이유: ...`;
}
```

---

## 4. 파일 파싱 & 업데이트 로직

```typescript
// AI 응답에서 파일 내용 추출
function parseAiResponse(response: string): { path: string; content: string } | null {
  // 코드 블록 추출 (```yaml, ```markdown, ```json, ```bash, ```python)
  const codeBlockRegex = /```(?:yaml|markdown|json|bash|python|sh)?\n([\s\S]*?)```/;
  const match = response.match(codeBlockRegex);
  
  if (!match) return null;
  
  const content = match[1].trim();
  
  // YAML frontmatter 유효성 검사 (SKILL.md, Agent MD)
  if (content.startsWith('---')) {
    try {
      const frontmatterEnd = content.indexOf('---', 3);
      const frontmatter = content.slice(3, frontmatterEnd);
      // 최소한 name, description 필드 확인
      if (!frontmatter.includes('name:') || !frontmatter.includes('description:')) {
        console.error('Invalid frontmatter: missing required fields');
        return null;
      }
    } catch (e) {
      return null;
    }
  }
  
  return { content };
}

// Diff 계산 (라인 단위)
function calculateDiff(before: string, after: string): DiffResult[] {
  const beforeLines = before.split('\n');
  const afterLines = after.split('\n');
  // diff 라이브러리 사용 또는 직접 구현
  // 변경/추가/삭제 라인 반환
}
```

---

## 5. 상태 관리 (`store/generatorStore.ts`)

```typescript
import { create } from 'zustand';

interface GeneratorState {
  // Step 1-4: 입력 데이터
  projectInput: ProjectInput | null;
  setProjectInput: (input: ProjectInput) => void;
  
  // Step 2: 생성된 파일들
  generatedFiles: GeneratedFile[];
  setGeneratedFiles: (files: GeneratedFile[]) => void;
  
  // Step 3: 현재 선택된 파일
  selectedFile: GeneratedFile | null;
  setSelectedFile: (file: GeneratedFile) => void;
  updateFileContent: (path: string, content: string) => void;
  
  // Step 3: 채팅 히스토리
  chatMessages: ChatMessage[];
  addChatMessage: (message: ChatMessage) => void;
  
  // Undo 히스토리
  fileHistory: Map<string, string[]>;
  undoFile: (path: string) => void;
}
```

---

## 6. UI 구현 핵심 포인트

### 폼 (Step 1-4)
- `React Hook Form` + `Zod` 스키마 검증
- Skill name 필드: 실시간으로 소문자-하이픈 형식 강제 (`/^[a-z][a-z0-9-]*$/`)
- 직무 선택 후 해당 직무 예시 템플릿 자동 채우기 버튼 표시
- 각 필드 옆에 `?` 아이콘 + 툴팁으로 설명 표시

### 결과 화면 (Step 2)
- 파일 목록 (좌측 또는 상단 탭)
- Monaco Editor로 파일 내용 표시 (읽기 전용, 신택스 하이라이트)
- ZIP 다운로드 버튼 + 개별 파일 다운로드 링크
- **"AI와 대화하며 개선하기"** CTA 버튼 (prominent)

### 채팅 화면 (Step 3)
- 좌측: 파일 뷰어 (Monaco Editor, diff 모드)
- 우측: 채팅 패널 (입력창 + 메시지 목록)
- AI 응답 Streaming 표시 (타이핑 애니메이션)
- 파일 업데이트 시 뷰어 자동 스크롤 + diff 하이라이트
- 상단에 현재 파일 선택 드롭다운
- Undo 버튼 (마지막 AI 수정 되돌리기)

---

## 7. ZIP 빌드 로직 (`lib/zipBuilder.ts`)

```typescript
import JSZip from 'jszip';

export async function buildZip(
  files: GeneratedFile[],
  readme: string
): Promise<Blob> {
  const zip = new JSZip();
  
  for (const file of files) {
    zip.file(file.path, file.content);
  }
  
  // README 추가
  zip.file('README.md', readme);
  
  return zip.generateAsync({ type: 'blob' });
}

// 다운로드 트리거
export function downloadZip(blob: Blob, projectName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}-claude-tools.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
```

---

## 8. 품질 체크리스트 (구현 완료 후 반드시 확인)

### 파일 생성 품질
- [ ] 생성된 SKILL.md의 description이 150자 이상인가?
- [ ] YAML frontmatter가 올바른 문법인가? (마지막 쉼표 없음)
- [ ] Skill name이 소문자-하이픈 형식인가?
- [ ] settings.json이 유효한 JSON인가? (`JSON.parse()` 검증)
- [ ] Hook 스크립트에 shebang이 있는가? (`#!/bin/bash`, `#!/usr/bin/env python3`)
- [ ] Agent MD의 permissionMode가 역할에 맞는가?
- [ ] README.md에 chmod 명령어가 포함되어 있는가?

### UI/UX 품질
- [ ] 폼 검증이 실시간으로 작동하는가?
- [ ] 예시 템플릿 자동 채우기가 동작하는가?
- [ ] ZIP 다운로드 후 파일 구조가 올바른가?
- [ ] AI 채팅에서 파일이 실시간 업데이트되는가?
- [ ] Diff 하이라이트가 제대로 표시되는가?

### 기술 품질
- [ ] API Route에서 에러 처리가 되어 있는가?
- [ ] 환경변수 `ANTHROPIC_API_KEY` 없을 때 적절한 에러 메시지가 나오는가?
- [ ] 모바일에서 레이아웃이 깨지지 않는가?
- [ ] TypeScript 타입 에러가 없는가?

---

## 9. 주의사항 & 금지사항

### ❌ 하지 말 것
1. **템플릿 하드코딩 금지** — 사용자 입력을 반드시 반영
2. **JSON 마지막 쉼표 금지** — settings.json 생성 시 반드시 `JSON.stringify()` 사용
3. **Skill description 짧게 생성 금지** — 최소 150자
4. **permissionMode 무작위 설정 금지** — 역할에 따라 정확히 결정
5. **스크립트 shebang 누락 금지**
6. **AI 채팅에서 파일 일부만 반환 금지** — 반드시 전체 파일 내용 반환

### ✅ 반드시 할 것
1. 사용자가 입력한 키워드를 description에 반드시 포함
2. 직무별 맞춤 내용 — 기획자/디자이너/개발자 각각 다른 내용
3. 검증 가이드의 실제 예시 파일 품질 수준 유지
4. AI 응답 파싱 실패 시 사용자에게 명확한 에러 메시지 표시
5. 생성 중 로딩 상태 표시
