# Project Skills For Codex

이 레포에서는 `.codex/skills`를 Codex 스킬 소스로 사용합니다.

## Skill Trigger Guide

- `dev-session-context-loader`: 세션 시작 시 `dev` 문서를 먼저 로드
  - 파일: `.codex/skills/dev-session-context-loader/SKILL.md`
- `api-route-developer`: Next.js API Route, `/api/generate`, `/api/chat`, Claude API 통합, 스트리밍 처리
  - 파일: `.codex/skills/api-route-developer/SKILL.md`
- `frontend-implementer`: App Router UI 구현, 폼/상태/컴포넌트 개발
  - 파일: `.codex/skills/frontend-implementer/SKILL.md`
- `ux-reviewer`: UX/접근성/반응형 리뷰(코드 수정 없이 리뷰 중심)
  - 파일: `.codex/skills/ux-reviewer/SKILL.md`
- `claude-api-integrator`: Anthropic SDK 호출, 프롬프트 설계, 파싱/에러 안정화
  - 파일: `.codex/skills/claude-api-integrator/SKILL.md`
- `nextjs-component-builder`: Next.js 컴포넌트/페이지 신속 구현
  - 파일: `.codex/skills/nextjs-component-builder/SKILL.md`

## Notes

- Codex 스킬 UI 메타데이터는 각 스킬 폴더의 `agents/openai.yaml`에 둡니다.
- `.codex/agents/*.md`는 Codex 스킬/에이전트 로딩 대상이 아니므로 사용하지 않습니다.
- 요청이 여러 역할에 걸치면 `api-route-developer` + `frontend-implementer` 순서로 처리하고, 마지막에 `ux-reviewer` 체크리스트로 품질 점검을 수행합니다.

## Session Startup

- 새 Codex 세션 시작 시 아래 명령으로 `dev` 문서를 먼저 로드합니다.
- `bash .codex/skills/dev-session-context-loader/scripts/load_dev_docs.sh`
