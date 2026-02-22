import { describe, expect, it } from 'vitest';

import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { baseInput } from '@/tests/fixtures';

describe('generateSkillMd', () => {
  it('description length should be >= 150 in generated skill file', () => {
    const result = createGeneratedPackage(baseInput);
    const skillFile = result.files.find((file) => file.path.endsWith('/SKILL.md'));

    expect(skillFile).toBeDefined();
    const descriptionLine = skillFile?.content
      .split('\n')
      .find((line) => line.startsWith('description: '));

    expect(descriptionLine).toBeDefined();
    expect((descriptionLine ?? '').replace('description: ', '').length).toBeGreaterThanOrEqual(150);
  });

  it('should include frontmatter and trigger keywords', () => {
    const result = createGeneratedPackage(baseInput);
    const skillFile = result.files.find((file) => file.path.endsWith('/SKILL.md'));

    expect(skillFile?.content).toContain('---\nname: ');
    expect(skillFile?.content).toContain('description: ');
    result.blueprint.triggerKeywords.forEach((keyword) => {
      expect(skillFile?.content).toContain(keyword);
    });
  });
});
