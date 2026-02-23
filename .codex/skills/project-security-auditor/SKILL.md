---
name: project-security-auditor
description: Next.js 기반 이 프로젝트의 보안을 실무 관점으로 점검하고 우선순위가 있는 개선안을 제시한다. API key 노출, `/api/generate`·`/api/chat` 입력 검증/경로 검증, AI API 호출 안정성(타임아웃/재시도), 의존성 취약점, 보안 헤더, 남용 방지(rate limiting/origin 검증) 점검이 필요할 때 사용한다. “보안 리뷰해줘”, “프로덕션 배포 전 점검”, “API key security 강화” 요청에서 이 스킬을 사용한다.
---

# Project Security Auditor

## Workflow

1. 레포 기준선을 먼저 파악한다: `package.json`, `app/api/*`, `lib/chat/*`, `next.config.mjs`, `apphosting.yaml`, `.env.example`.
2. 자동 점검을 먼저 실행한다: `bash .codex/skills/project-security-auditor/scripts/run_security_checks.sh`.
3. 자동 점검 결과를 확인한 뒤 수동 리뷰를 수행한다:
   - 서버 경계: 입력 검증(Zod), 경로 allowlist, 오류 응답, 비정상 입력 처리.
   - 남용 방지: 인증/권한, origin 검증, rate limiting, 요청 크기/빈도 제한.
   - 비밀정보: API key가 클라이언트 번들/로그/응답으로 노출되지 않는지 확인.
   - AI 호출 안정성: timeout, 재시도, stop_reason 처리, 중단/복구 경로 확인.
   - 렌더링 안전성: `dangerouslySetInnerHTML`, 직접 HTML 주입, 실행형 문자열 API 사용 여부 확인.
   - 배포 설정: 런타임 시크릿 사용, 불필요한 BUILD 노출 제거, 보안 헤더 정책 확인.
4. 이 레포의 우선 점검 파일을 먼저 확인한다:
   - `app/api/chat/route.ts`
   - `app/api/generate/route.ts`
   - `lib/chat/validateFileUpdate.ts`
   - `lib/chat/qualityGate.ts`
   - `next.config.mjs`
   - `apphosting.yaml`
5. 결과를 심각도 순서로 보고한다. 파일 경로와 구체적 근거를 반드시 포함한다.

## Severity Rules

- `Critical`: 즉시 악용 가능하거나 비용/권한/데이터에 직접 영향. 배포 차단.
- `High`: 공격 난이도가 낮고 영향이 큰 항목. 단기 수정.
- `Medium`: 방어 심층화 또는 오용 시 위험 증가. 계획 수정.
- `Low`: 위생/하드닝 항목. 백로그 처리.

## Output Format

1. `Findings (Critical -> Low)`
2. 각 항목에 `영향`, `재현/근거`, `수정안`, `관련 파일`을 포함한다.
3. 마지막에 `Quick Wins (오늘 적용 가능)` 1~3개를 제시한다.
4. 코드 변경이 필요한 경우 최소 수정안(diff 또는 정확한 파일 단위 수정 지시)으로 제시한다.

## Guardrails

- 추측으로 취약점을 단정하지 않는다. 반드시 코드 근거를 제시한다.
- “일반론”보다 “이 레포에서 실제로 관찰된 리스크”를 우선한다.
- 보안 이슈를 발견해도 API key 원문/민감정보를 출력하지 않는다.
- 리뷰 요청 시 기능 요약보다 취약점/리스크를 먼저 보고한다.

## Resources

- 현재 프로젝트 기준선: `references/project-security-baseline.md`
- 수정 플레이북: `references/security-remediation-playbook.md`
- 자동 점검 스크립트: `scripts/run_security_checks.sh`
