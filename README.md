# Claude 커스텀 도구 생성기 (Idea-first MVP)

`dev/AI_INSTRUCTIONS.md`, `dev/PRD.md`, `AGENTS.md`를 기반으로 재구성한 아이디어 중심 MVP입니다.

## 핵심 컨셉
- 복잡한 단계 입력 대신 **단일 아이디어 폼**으로 전환
- 기술 스택/세부 도구를 사용자가 직접 설계하지 않아도 됨
- 아이디어 맥락으로 필요한 Skill/Hook/Agent를 자동 생성

## 구현 범위
- 아이디어 입력 폼(단일 페이지)
- 자동 생성 API: `POST /api/generate`
- 생성 결과 검토 + ZIP 다운로드
- Step 3 AI 대화형 개선: `POST /api/chat` + 실시간 반영 + diff + undo

## 기술 스택
- Next.js 14 (App Router) + TypeScript
- Tailwind CSS
- React Hook Form + Zod
- Zustand
- JSZip
- Vitest

## 실행 방법
```bash
npm install
npm run dev
```

## Claude API 설정
`.env.local` 파일을 만들고 API 키를 넣어주세요.

```bash
CLAUDE_API_KEY=your_claude_api_key
# 선택: 생성용 모델 (기본값 claude-sonnet-4-5)
CLAUDE_MODEL=claude-sonnet-4-5
CLAUDE_GENERATE_TIMEOUT_MS=45000
# 선택: 채팅용 모델 (미설정 시 기본값 claude-sonnet-4-5)
CLAUDE_CHAT_MODEL=claude-sonnet-4-5
CLAUDE_CHAT_MAX_TOKENS=16384
CLAUDE_CHAT_MAX_RESPONSE_CHARS=1000000
CLAUDE_CHAT_STREAM_TOTAL_TIMEOUT_MS=180000
CLAUDE_CHAT_STREAM_IDLE_TIMEOUT_MS=30000
CLAUDE_CHAT_RECOVERY_TIMEOUT_MS=45000
ORIGIN_CHECK_STRICT=true
APP_ORIGIN=https://your-domain.example
RATE_LIMIT_WINDOW_MS=60000
CHAT_RATE_LIMIT_MAX=45
GENERATE_RATE_LIMIT_MAX=20
# 선택: /api/chat 컨텍스트 정책 (quality_guard_v1 | legacy)
CHAT_CONTEXT_POLICY=quality_guard_v1
CHAT_CONTEXT_TOTAL_BUDGET_CHARS=180000
CHAT_CONTEXT_FILE_BUDGET_CHARS=110000
CHAT_CONTEXT_HISTORY_BUDGET_CHARS=60000
CHAT_CONTEXT_MAX_MESSAGE_CHARS=12000
CHAT_CONTEXT_MAX_HISTORY_TURNS=100
CHAT_CONTEXT_MAX_HISTORY_TURN_CHARS=4000
CHAT_CONTEXT_PINNED_HISTORY_TURNS=16
```

- `CLAUDE_API_KEY`가 있으면 `/api/generate`가 Claude API를 사용해 Skill/Hook/Agent 초안을 만듭니다.
- 키가 없거나 API 호출에 실패하면 기존 규칙 기반 생성으로 자동 폴백됩니다.
- `/api/chat`는 SSE 스트리밍으로 응답하며, 코드블록 검증 성공 시 선택 파일을 자동 반영합니다.
- `/api/chat`는 컨텍스트 초과/검증 스킵 상황에서도 팝업/토스트 없이 조용히 최적화/반영 스킵 처리합니다.
- `ORIGIN_CHECK_STRICT=true`이면 `/api/chat`, `/api/generate`에서 origin/referer를 검증합니다.
- `RATE_LIMIT_WINDOW_MS`, `CHAT_RATE_LIMIT_MAX`, `GENERATE_RATE_LIMIT_MAX`로 요청 한도를 제어합니다.

## 검증 명령
```bash
npm run typecheck
npm run test
npm run lint
npm run build
```

## 생성 결과 포맷
Claude 우선 포맷으로 파일을 생성합니다.

- `skills/<skill-name>/SKILL.md`
- `hooks/settings.json`
- `hooks/scripts/*`
- `agents/<agent-name>.md`
- `README.md` (ZIP 내부)

## 세션 시작 권장
```bash
bash .codex/skills/dev-session-context-loader/scripts/load_dev_docs.sh
```
