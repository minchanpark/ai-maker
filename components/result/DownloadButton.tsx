'use client';

import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { buildZip, downloadZip } from '@/lib/zipBuilder';
import type { GeneratedFile } from '@/types';

interface DownloadButtonProps {
  files: GeneratedFile[];
  readme: string;
  projectName: string;
}

export function DownloadButton({ files, readme, projectName }: DownloadButtonProps) {
  const [downloading, setDownloading] = useState(false);

  const onDownload = async () => {
    setDownloading(true);
    try {
      const blob = await buildZip(files, readme);
      downloadZip(blob, projectName);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Button onClick={onDownload} disabled={files.length === 0 || downloading}>
      {downloading ? 'ZIP 생성 중...' : 'ZIP 전체 다운로드'}
    </Button>
  );
}
