---
name: nextjs-component-builder
description: Next.js 14 App Router 기반 컴포넌트 및 페이지를 생성할 때 사용하세요. "컴포넌트 만들어줘", "페이지 추가", "폼 구현", "UI 레이아웃", "shadcn/ui", "Tailwind", "React Hook Form", "Zod" 키워드가 포함된 요청에 자동 트리거됩니다. Zustand 상태 관리, Monaco Editor 통합, 반응형 레이아웃, 다크모드 고려, 접근성(ARIA) 준수, loading/empty/error 상태 완비를 기본 품질 기준으로 적용합니다.
---

# Next.js Component Builder

## 작업 프로세스

### 0. 먼저 확인할 입력
- **목적**: 어떤 사용자 액션을 처리하는 컴포넌트인가?
- **스택 제약**: App Router (Server/Client Component 구분), Tailwind, shadcn/ui, Zustand
- **산출물 형태**: 단독 컴포넌트 / 페이지 레이아웃 / 폼 / 모달 중 무엇인가?

### 1. 코드 작성 전: 컴포넌트 방향 설정

**Server vs Client 판단 기준**
- 데이터 fetching / 정적 렌더링 → `Server Component` (default)
- useState, useEffect, 이벤트 핸들러, 브라우저 API → `"use client"` 선언
- Zustand store 접근 → 반드시 Client Component

**shadcn/ui 사용 원칙**
- 기존 shadcn 컴포넌트 우선 활용 (Button, Input, Select, Tabs, Dialog, Card 등)
- 커스텀 스타일은 `cn()` 유틸로 Tailwind 클래스 병합
- `@/components/ui/` 경로에서 import

**폼 구현 패턴**
```tsx
// 항상 React Hook Form + Zod 조합 사용
const schema = z.object({ ... })
const form = useForm<z.infer<typeof schema>>({
  resolver: zodResolver(schema),
  defaultValues: { ... }
})
```

### 2. 구현 기준

**필수 상태 처리**
- Loading: Skeleton 컴포넌트 또는 Spinner 표시
- Empty: 빈 상태 일러스트 또는 안내 메시지
- Error: 에러 메시지 + 재시도 버튼
- Success: 성공 피드백 (toast 또는 인라인 메시지)

**Zustand 패턴**
```tsx
// store는 src/stores/ 아래에 위치
// 컴포넌트에서는 selector로 필요한 값만 구독
const files = useGeneratorStore((s) => s.files)
const setFiles = useGeneratorStore((s) => s.setFiles)
```

**반응형 레이아웃**
- Mobile-first: `sm:`, `md:`, `lg:` 순서로 작성
- 핵심 UI는 375px 이상에서 동작 보장

**타입 안전성**
- props는 반드시 TypeScript interface 정의
- `any` 사용 금지; 불명확한 타입은 `unknown` + type guard 사용
- API 응답 타입은 `src/types/` 아래 공유 타입 사용

### 3. 절대 피하기

- `"use client"` 없이 `useState` / `useEffect` 사용
- Tailwind 클래스 인라인 object style 혼용
- shadcn 컴포넌트를 직접 수정 (대신 wrapper 컴포넌트 생성)
- 하드코딩된 색상값 (Tailwind 토큰 사용)
- 이미지에 alt 속성 누락
- 폼 submit 시 중복 요청 방지 로직 누락

## 출력 포맷

```
1. 컴포넌트 파일 전체 (경로 명시: src/components/... 또는 src/app/...)
2. 필요한 경우 타입 정의 (src/types/...)
3. Zustand store 변경이 필요한 경우 store 코드 포함
4. 사용 예시 (주석 또는 별도 코드 블록)
```
