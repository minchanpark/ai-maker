'use client';

import dynamic from 'next/dynamic';

import type { GeneratedFile } from '@/types';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface FileViewerProps {
  file: GeneratedFile | null;
}

const LANGUAGE_MAP: Record<string, string> = {
  markdown: 'markdown',
  json: 'json',
  bash: 'shell',
  python: 'python',
};

export function FileViewer({ file }: FileViewerProps) {
  if (!file) {
    return (
      <div className="flex h-[520px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
        파일을 선택하면 내용이 표시됩니다.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{file.path}</div>
      <MonacoEditor
        height="520px"
        language={LANGUAGE_MAP[file.language] ?? 'markdown'}
        value={file.content}
        options={{
          readOnly: true,
          minimap: { enabled: false },
          fontSize: 13,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
        }}
      />
    </div>
  );
}
