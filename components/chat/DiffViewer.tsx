'use client';

import dynamic from 'next/dynamic';

interface DiffViewerProps {
  path: string | null;
  language: 'markdown' | 'json' | 'bash' | 'python' | null;
  before: string;
  after: string;
}

const MonacoDiffEditor = dynamic(
  () => import('@monaco-editor/react').then((module) => module.DiffEditor),
  { ssr: false },
);

const LANGUAGE_MAP: Record<NonNullable<DiffViewerProps['language']>, string> = {
  markdown: 'markdown',
  json: 'json',
  bash: 'shell',
  python: 'python',
};

export function DiffViewer({ path, language, before, after }: DiffViewerProps) {
  if (!path || !language) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        아직 비교할 변경 사항이 없습니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{path} 변경 비교</div>
      <MonacoDiffEditor
        height="520px"
        original={before}
        modified={after}
        language={LANGUAGE_MAP[language]}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          renderSideBySide: true,
        }}
      />
    </div>
  );
}
