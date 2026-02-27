import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-4 py-12 sm:px-6">
      <Card className="space-y-6 p-8 sm:p-10">
        <div className="space-y-3">
          <p className="inline-flex rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">Idea-first MVP</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-4xl">Claude Code 커스텀 도구 생성기</h1>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="p-4">
            <h2 className="text-sm font-semibold">아이디어 입력</h2>
            <p className="mt-1 text-sm text-slate-600">기술 스택 대신 문제/사용자/핵심 기능 중심</p>
          </Card>
          <Card className="p-4">
            <h2 className="text-sm font-semibold">자동 설계</h2>
            <p className="mt-1 text-sm text-slate-600">필요한 Skill/Hook/Agent 조합 자동 추천</p>
          </Card>
          <Card className="p-4">
            <h2 className="text-sm font-semibold">즉시 다운로드</h2>
            <p className="mt-1 text-sm text-slate-600">생성 파일 검토 후 ZIP 다운로드</p>
          </Card>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/generate">
            <Button>아이디어로 생성 시작</Button>
          </Link>
          <Link href="/result">
            <Button variant="outline">최근 결과 보기</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
