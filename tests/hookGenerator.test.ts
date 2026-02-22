import { describe, expect, it } from 'vitest';

import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { baseInput } from '@/tests/fixtures';

describe('generateHookFiles', () => {
  it('should generate settings.json and scripts from idea-driven blueprint', () => {
    const result = createGeneratedPackage({
      ...baseInput,
      collaborationMode: 'safe',
      automationLevel: 'aggressive',
    });

    const settings = result.files.find((file) => file.path === 'hooks/settings.json');

    expect(settings).toBeDefined();
    expect(settings?.content).toContain('SessionStart');
    expect(settings?.content).toContain('PostToolUse');
    expect(settings?.content).toContain('PreToolUse');
    expect(settings?.content).toContain('"timeout": 10');
    expect(settings?.content).toContain('"timeout": 60');

    expect(result.files.some((file) => file.path.endsWith('format_code.sh'))).toBe(true);
    expect(result.files.some((file) => file.path.endsWith('lint_code.sh'))).toBe(true);
    expect(result.files.some((file) => file.path.endsWith('protect_paths.py'))).toBe(true);
  });
});
