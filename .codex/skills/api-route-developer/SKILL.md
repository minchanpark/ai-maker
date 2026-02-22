---
name: api-route-developer
description: Next.js App Router API Route 구현과 Anthropic Claude API 백엔드 통합에 사용한다. `/api/generate`, `/api/chat`, 스트리밍(SSE/ReadableStream), Zod 요청 검증, 프롬프트 빌더, 응답 파싱, 에러 상태코드 설계가 필요한 작업에서 이 스킬을 사용한다. 파일 생성 JSON 스키마 강제, 보안(입력 sanitize, API 키 비노출), 운영 안정성(타임아웃/재시도/로깅 정책)까지 함께 다룬다.
---

# API Route Developer

## Workflow

1. 시작 시 `src/app/api/`, `src/types/`, `src/lib/`, `.env.example`를 점검한다.
2. 요청 바디를 Zod로 `safeParse` 검증하고 실패 시 `400`과 필드 오류를 반환한다.
3. 사용자 입력을 sanitize한 뒤 시스템/유저 프롬프트를 분리해 구성한다.
4. 서버에서만 `ANTHROPIC_API_KEY`를 사용해 Claude API를 호출한다.
5. 스트리밍 라우트는 청크 전송 중 에러 이벤트를 반드시 내려준다.
6. 비스트리밍 라우트는 응답을 `GeneratedFile[]`로 파싱하고 스키마를 재검증한다.
7. 에러를 `401`, `429`, `500`으로 분기하고 재시도 가능 여부를 명시한다.

## Implementation Rules

- 모든 외부 I/O `await`는 `try/catch` 경계 안에서 처리한다.
- 모델 응답이 코드블록/텍스트 혼합이어도 JSON 추출 실패를 안전하게 처리한다.
- `name` 필드는 `^[a-z][a-z0-9-]*$` 정규식으로 검증한다.
- 타임아웃(예: 30초)과 최소 1회 재시도 정책을 적용한다.
- API 키, 개인정보, 전체 프롬프트 원문을 서버 로그에 남기지 않는다.

## Validation

```bash
npx tsc --noEmit
curl -X POST http://localhost:3000/api/generate -H "Content-Type: application/json" -d '{"projectName":"demo"}'
```

## Output

- 수정 파일 목록과 목적
- 요청/응답 스키마 요약
- 상태코드별 처리 근거
- `.env.example` 변경 항목
