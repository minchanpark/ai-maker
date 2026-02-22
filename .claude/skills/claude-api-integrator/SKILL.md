---
name: claude-api-integrator
description: Anthropic Claude API 호출, 스트리밍 응답 처리, 파일 생성 프롬프트 설계, API Route 구현에 사용하세요. "API Route", "스트리밍", "Claude 호출", "프롬프트 작성", "파일 생성 로직", "ANTHROPIC_API_KEY", "/api/generate", "/api/chat" 키워드가 포함된 요청에 자동 트리거됩니다. 스트리밍 응답 파싱, YAML frontmatter 유효성 검증, 코드 블록 추출, 에러 핸들링 베스트 프랙티스를 자동 적용합니다.
---

# Claude API Integrator

## 작업 프로세스

### 0. 먼저 확인할 입력
- **엔드포인트 목적**: 파일 생성(`/api/generate`) vs AI 대화 개선(`/api/chat`) 중 무엇인가?
- **스트리밍 여부**: 채팅 응답은 스트리밍, 파일 생성은 일반 응답
- **산출물 형태**: JSON 파일 목록 / 스트리밍 텍스트 / 수정된 파일 내용 중 무엇인가?

### 1. API Route 설계 방향

**파일 생성 엔드포인트 (`/api/generate`)**
```typescript
// POST /api/generate
// Body: ProjectInput
// Response: GeneratedPackage (JSON)
export async function POST(req: Request) {
  const input: ProjectInput = await req.json()
  // 1. 입력 검증 (Zod)
  // 2. 직무별 프롬프트 조합
  // 3. Claude API 호출 (non-streaming)
  // 4. 응답 파싱 → GeneratedFile[] 변환
  // 5. README.md 생성
  return Response.json({ files, readme })
}
```

**AI 대화 엔드포인트 (`/api/chat`)**
```typescript
// POST /api/chat
// Body: { messages, currentFile, projectInput }
// Response: ReadableStream (Server-Sent Events)
export async function POST(req: Request) {
  const stream = await anthropic.messages.stream({ ... })
  return new Response(stream.toReadableStream())
}
```

### 2. 구현 기준

**Anthropic SDK 사용 패턴**
```typescript
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

// 스트리밍
const stream = anthropic.messages.stream({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  system: systemPrompt,
  messages: conversationHistory
})
```

**스트리밍 응답 프론트엔드 수신 패턴**
```typescript
const response = await fetch('/api/chat', { method: 'POST', body })
const reader = response.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const chunk = decoder.decode(value)
  // UI 실시간 업데이트
}
```

**파일 생성 프롬프트 구조**
```
System: Claude Code Skills/Hooks/SubAgents 전문가. 다음 형식을 엄격히 준수.
User:
  ## 프로젝트 정보
  - 이름: {projectName}
  - 설명: {projectDescription}
  - 기술 스택: {techStack}
  - 직무: {role}

  ## 생성할 파일 목록
  {파일별 요구사항}

  ## 출력 형식
  각 파일을 JSON 배열로 반환: [{ "path": "...", "content": "..." }]
```

**응답 파싱 (코드 블록 추출)**
```typescript
function extractFilesFromResponse(text: string): GeneratedFile[] {
  // ```json 블록 추출 → JSON.parse
  // YAML frontmatter 유효성 검사
  // name 필드 정규식 검증: /^[a-z][a-z0-9-]*$/
}
```

**에러 처리**
- `ANTHROPIC_API_KEY` 미설정 → 명확한 에러 메시지
- API rate limit → 429 응답과 함께 재시도 안내
- 파싱 실패 → 원본 텍스트 보존 + 에러 상태 표시
- timeout: 30초 이내 응답 없으면 중단

### 3. 절대 피하기

- `ANTHROPIC_API_KEY`를 클라이언트 코드에서 직접 사용 (반드시 API Route 통해서만)
- 스트리밍 중 에러 발생 시 무응답 (반드시 에러 청크 전송)
- 프롬프트에 사용자 입력 무결 삽입 (XSS/인젝션 방지용 sanitize 필수)
- `any` 타입으로 API 응답 처리
- 재시도 없이 단일 API 호출에만 의존

## 출력 포맷

```
1. API Route 파일 전체 (src/app/api/.../route.ts)
2. 관련 타입 정의 (src/types/api.ts)
3. 프론트엔드 fetch 헬퍼 함수 (src/lib/api.ts)
4. 에러 케이스별 처리 코드 포함
5. 환경변수 .env.example 업데이트 항목 명시
```
