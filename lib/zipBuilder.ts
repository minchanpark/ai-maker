import JSZip from 'jszip';

import type { GeneratedFile } from '@/types';

export async function buildZip(files: GeneratedFile[], readme: string): Promise<Blob> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  zip.file('README.md', readme);

  return zip.generateAsync({ type: 'blob' });
}

export async function buildZipBuffer(files: GeneratedFile[], readme: string): Promise<Buffer> {
  const zip = new JSZip();

  files.forEach((file) => {
    zip.file(file.path, file.content);
  });

  zip.file('README.md', readme);

  return zip.generateAsync({ type: 'nodebuffer' });
}

export function downloadZip(blob: Blob, projectName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${projectName}-claude-tools.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
