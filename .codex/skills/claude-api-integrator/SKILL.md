---
name: claude-api-integrator
description: Anthropic Claude API 연동 로직 구현 및 개선에 사용한다. 스트리밍 응답 처리, 파일 생성 프롬프트 설계, 코드블록/JSON 파싱, YAML frontmatter 검증, Rate Limit/Timeout/Retry 대응, `/api/generate`와 `/api/chat` 안정화가 필요한 작업에서 이 스킬을 사용한다.
---

# Claude API Integrator

## Workflow

1. 엔드포인트 목적을 분리한다: 파일 생성(비스트리밍) vs 대화(스트리밍).
2. 입력 스키마를 정의하고 프롬프트 입력값을 sanitize한다.
3. Anthropic SDK 호출 설정(모델, max_tokens, timeout)을 명시한다.
4. 응답을 구조화 파싱하고 실패 시 원문 보존 + 오류 상태를 반환한다.
5. 운영 예외(401/429/5xx)를 분기하고 재시도/대기 전략을 적용한다.

## Implementation Rules

- API 키는 서버 환경변수만 사용하고 클라이언트에 전달하지 않는다.
- 스트리밍 중 실패 시 연결 종료만 하지 말고 오류 이벤트를 전송한다.
- 파일 생성 응답은 JSON 배열 형식을 강제 검증한다.
- 파싱 실패 시 디버깅 가능한 요약 정보만 로그에 남긴다.

## Output

- API route 변경 코드
- 프롬프트 설계 요약
- 파싱/검증 로직 요약
- 장애 대응(타임아웃/레이트리밋/재시도) 정책
