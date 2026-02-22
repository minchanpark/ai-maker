import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

import { buildZipBuffer } from '@/lib/zipBuilder';

describe('buildZipBuffer', () => {
  it('should include generated files and README.md', async () => {
    const files = [
      {
        path: 'skills/project-orchestrator/SKILL.md',
        content: 'test',
        type: 'skill' as const,
        language: 'markdown' as const,
      },
      {
        path: 'hooks/settings.json',
        content: '{}',
        type: 'hook-config' as const,
        language: 'json' as const,
      },
    ];

    const buffer = await buildZipBuffer(files, '# README');
    const zip = await JSZip.loadAsync(buffer);

    expect(zip.file('skills/project-orchestrator/SKILL.md')).toBeTruthy();
    expect(zip.file('hooks/settings.json')).toBeTruthy();
    expect(zip.file('README.md')).toBeTruthy();
  });
});
