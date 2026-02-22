---
name: dev-session-context-loader
description: Codex 세션 시작 시 `dev` 디렉토리 문서를 우선 로드하고 작업 컨텍스트를 정렬할 때 사용한다. 세션 온보딩, 작업 착수 전 요구사항 정리, PRD/가이드 재확인, "dev 문서 먼저 읽어줘" 같은 요청에서 이 스킬을 사용한다. `dev/AGENTS.md`, `dev/AI_INSTRUCTIONS.md`, `dev/PRD.md`를 우선 순서로 읽고 나머지 `dev/*.md`를 추가 로드해 요약 및 실행 체크리스트를 만든다.
---

# Dev Session Context Loader

## Workflow

1. 세션 시작 시 `scripts/load_dev_docs.sh`를 실행해 `dev` 문서를 로드한다.
2. 우선 문서(`dev/AGENTS.md`, `dev/AI_INSTRUCTIONS.md`, `dev/PRD.md`)를 먼저 읽고 핵심 제약을 추출한다.
3. 나머지 `dev/*.md`를 읽고 현재 요청과 관련된 항목만 추가 요약한다.
4. 작업 시작 전 "이번 세션 적용 규칙"을 3~7줄로 정리해 내부 작업 기준으로 사용한다.
5. 세션 중 `dev` 문서가 변경되면 스크립트를 재실행해 컨텍스트를 갱신한다.

## Commands

```bash
bash .codex/skills/dev-session-context-loader/scripts/load_dev_docs.sh
```

프로젝트 루트가 현재 디렉토리가 아닐 때:

```bash
bash .codex/skills/dev-session-context-loader/scripts/load_dev_docs.sh /path/to/project
```

## Output

- 로드한 문서 목록
- 세션 적용 규칙 요약
- 필요 시 추가로 정독할 문서 목록

## References

- 상세 절차: `references/startup-checklist.md`
