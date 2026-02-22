---
name: frontend-implementer
description: Next.js 14 App Router 프론트엔드 구현에 사용한다. 다단계 폼, 파일 뷰어, 스트리밍 채팅, Diff UI, 다운로드 UI를 Tailwind CSS, shadcn/ui, Zustand, React Hook Form, Zod 기반으로 구현할 때 이 스킬을 사용한다. 컴포넌트 경계(Server/Client), 접근성, 반응형, 로딩/빈 상태/오류 상태 완비가 핵심 요구사항인 작업에 적합하다.
---

# Frontend Implementer

## Workflow

1. `src/app/`, `src/components/`, `src/stores/`, `src/types/`, `package.json`을 먼저 스캔한다.
2. 타입 정의를 먼저 확정하고 상태 저장소(Zustand)를 그다음에 설계한다.
3. 재사용 컴포넌트를 구현한 뒤 페이지 컴포넌트에서 조합한다.
4. 모든 비동기 UI에 `loading`, `empty`, `error`, `success` 상태를 구현한다.
5. 폼은 React Hook Form + Zod 조합으로 검증 메시지까지 연결한다.

## Implementation Rules

- `useState`, `useEffect`, 이벤트 핸들러가 있으면 Client Component로 선언한다.
- `src/components/ui/` 원본은 수정하지 않고 래퍼 컴포넌트를 만든다.
- 아이콘 전용 버튼에는 `aria-label`을 넣고 폼 입력은 `label` 연결을 보장한다.
- 모바일 기준(375px)부터 데스크톱(1440px)까지 레이아웃 깨짐이 없어야 한다.
- `any` 타입을 사용하지 않는다.

## Validation

```bash
npx tsc --noEmit
```

## Output

- 생성/수정 파일과 핵심 변경점
- 상태 처리(loading/empty/error) 적용 위치
- 접근성/반응형 확인 결과
