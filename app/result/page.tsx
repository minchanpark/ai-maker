'use client';

import Link from 'next/link';

import { DownloadButton } from '@/components/result/DownloadButton';
import { FileList } from '@/components/result/FileList';
import { FileViewer } from '@/components/result/FileViewer';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useGeneratorStore } from '@/store/generatorStore';

function downloadSingleFile(path: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = path.split('/').pop() ?? 'file.txt';
  a.click();
  URL.revokeObjectURL(url);
}

export default function ResultPage() {
  const { generatedPackage, selectedPath, setSelectedPath } = useGeneratorStore();

  if (!generatedPackage) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-4xl items-center px-4 py-10">
        <Card className="w-full space-y-4">
          <h1 className="text-xl font-bold">생성 결과가 없습니다.</h1>
          <p className="text-sm text-slate-600">먼저 생성 페이지에서 아이디어를 입력해 주세요.</p>
          <Link href="/generate">
            <Button>생성 페이지로 이동</Button>
          </Link>
        </Card>
      </main>
    );
  }

  const selectedFile = generatedPackage.files.find((file) => file.path === selectedPath) ?? generatedPackage.files[0] ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">자동 생성 결과</h1>
        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">AI 개선 가능</span>
      </div>

      <Card className="mb-4 space-y-2">
        <h2 className="text-sm font-semibold">생성 요약</h2>
        <p className="text-sm text-slate-700">
          생성 방식: {generatedPackage.generationSource === 'claude' ? 'Claude API' : '규칙 기반'}
        </p>
        <p className="text-sm text-slate-700">Primary role: {generatedPackage.blueprint.primaryRole}</p>
        <p className="text-sm text-slate-700">Skill: {generatedPackage.blueprint.skillName}</p>
        <p className="text-sm text-slate-700">Hook events: {generatedPackage.blueprint.hookEvents.join(', ') || '없음'}</p>
        <p className="text-sm text-slate-700">Agents: {generatedPackage.blueprint.agentNames.join(', ')}</p>
      </Card>

      {generatedPackage.warnings?.length ? (
        <Card className="mb-4 border-amber-300 bg-amber-50">
          <h2 className="text-sm font-semibold text-amber-800">안내</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900">
            {generatedPackage.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">생성된 파일</h2>
            <span className="text-xs text-slate-500">{generatedPackage.files.length}개</span>
          </div>
          <FileList files={generatedPackage.files} selectedPath={selectedFile?.path ?? null} onSelect={setSelectedPath} />
        </Card>

        <div className="space-y-4">
          <FileViewer file={selectedFile} />
          <Card className="flex flex-wrap items-center gap-3">
            <DownloadButton
              files={generatedPackage.files}
              readme={generatedPackage.readme}
              projectName={generatedPackage.projectInput.projectName}
            />
            <Button
              variant="outline"
              disabled={!selectedFile}
              onClick={() => selectedFile && downloadSingleFile(selectedFile.path, selectedFile.content)}
            >
              선택 파일 다운로드
            </Button>
            <Link href="/chat">
              <Button variant="ghost">AI와 대화하며 개선하기</Button>
            </Link>
          </Card>
        </div>
      </div>
    </main>
  );
}
