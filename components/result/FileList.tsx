'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { GeneratedFile } from '@/types';

interface FileListProps {
  files: GeneratedFile[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function FileList({ files, selectedPath, onSelect }: FileListProps) {
  if (files.length === 0) {
    return <p className="text-sm text-slate-500">생성된 파일이 없습니다.</p>;
  }

  return (
    <ul className="space-y-1">
      {files.map((file) => {
        const active = selectedPath === file.path;
        return (
          <li key={file.path}>
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm',
                active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700',
              )}
              onClick={() => onSelect(file.path)}
            >
              <span className="truncate">{file.path}</span>
              <Badge className={active ? 'bg-white/20 text-white' : ''}>{file.language}</Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
