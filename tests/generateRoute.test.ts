import { describe, expect, it } from 'vitest';

import { POST } from '@/app/api/generate/route';
import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { baseInput } from '@/tests/fixtures';

describe('/api/generate', () => {
  it('should generate package for each focus-led scenario', () => {
    const scenarios = [
      { focusAreas: ['planning'] as const, expectedRole: 'planner' as const },
      { focusAreas: ['design'] as const, expectedRole: 'designer' as const },
      { focusAreas: ['development'] as const, expectedRole: 'developer' as const },
    ];

    for (const scenario of scenarios) {
      const result = createGeneratedPackage({
        ...baseInput,
        focusAreas: [...scenario.focusAreas],
      });

      expect(result.blueprint.primaryRole).toBe(scenario.expectedRole);
      expect(result.files.length).toBeGreaterThan(0);
      expect(result.files.some((file) => file.path.endsWith('/SKILL.md'))).toBe(true);
      expect(result.files.some((file) => file.path === 'hooks/settings.json')).toBe(true);
      expect(result.files.some((file) => file.path.startsWith('agents/'))).toBe(true);
      expect(result.readme).toContain('Claude Code 커스텀 도구 설치 가이드');
    }
  });

  it('should return 400 when required field is missing', async () => {
    const req = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projectName: 'only name',
      }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.error).toContain('검증');
  });

  it('should return 200 for valid payload', async () => {
    const req = new Request('http://localhost/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(baseInput),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(Array.isArray(json.files)).toBe(true);
    expect(typeof json.readme).toBe('string');
    expect(typeof json.blueprint.skillName).toBe('string');
  });
});
