---
name: nextjs-component-builder
description: Next.js 14 App Router 기반의 컴포넌트/페이지를 빠르게 구현할 때 사용한다. 폼, 레이아웃, 모달, 탭, 리스트, 상태 기반 UI를 Tailwind + shadcn/ui + React Hook Form + Zod + Zustand로 구성하고, 타입 안정성/접근성/반응형을 함께 충족해야 하는 요청에서 이 스킬을 사용한다.
---

# Next.js Component Builder

## Workflow

1. 요구사항을 UI 단위(컴포넌트/페이지/상태)로 분해한다.
2. Server/Client 경계를 먼저 결정한다.
3. 폼/상태/표시 컴포넌트를 분리해 구현한다.
4. 상태별 UI(loading/empty/error/success)와 접근성을 보강한다.
5. 타입 점검 후 페이지에 통합한다.

## Implementation Rules

- 폼은 React Hook Form + Zod 조합을 기본으로 사용한다.
- Zustand는 selector 기반 구독으로 불필요 렌더를 줄인다.
- 이미지에는 `alt`, 아이콘 버튼에는 `aria-label`을 항상 넣는다.
- 하드코딩 색상 대신 Tailwind 토큰/디자인 토큰을 사용한다.
- `any`를 금지하고 공유 타입은 `src/types`에 둔다.

## Constraints

- `src/components/ui/` 원본을 직접 수정하지 않는다.
- 클라이언트 코드에 비밀값(API 키 등)을 노출하지 않는다.

## Output

- 생성한 컴포넌트/페이지 코드
- 추가/변경된 타입 및 스토어
- 사용 예시 또는 통합 방법
