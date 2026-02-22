import { describe, expect, it } from 'vitest';

import { createGeneratedPackage } from '@/lib/api/generatePackage';
import { evaluateUpdate } from '@/lib/chat/qualityGate';
import { baseInput } from '@/tests/fixtures';

describe('evaluateUpdate', () => {
  it('passes quality gate for safe SKILL.md update', () => {
    const generated = createGeneratedPackage(baseInput);
    const skill = generated.files.find((file) => file.path.endsWith('/SKILL.md'))!;

    const after = skill.content.replace(
      /^description: .+$/m,
      `description: ${'요청 맥락을 유지하면서 실행 가능한 기준과 검증 항목을 명확히 안내합니다. '.repeat(4).trim()}`,
    );

    const result = evaluateUpdate({
      path: skill.path,
      before: skill.content,
      after,
      blueprint: generated.blueprint,
    });

    expect(result.ok).toBe(true);
    expect(result.scores.afterScore).toBeGreaterThanOrEqual(85);
  });

  it('rejects SKILL.md name mutation', () => {
    const generated = createGeneratedPackage(baseInput);
    const skill = generated.files.find((file) => file.path.endsWith('/SKILL.md'))!;

    const after = skill.content.replace(/^name: .+$/m, 'name: mutated-skill-name');

    const result = evaluateUpdate({
      path: skill.path,
      before: skill.content,
      after,
      blueprint: generated.blueprint,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('name');
  });

  it('rejects excessive rewrite by change ratio threshold', () => {
    const generated = createGeneratedPackage(baseInput);
    const skill = generated.files.find((file) => file.path.endsWith('/SKILL.md'))!;

    const after = `---\nname: ${generated.blueprint.skillName}\ndescription: ${'검증 기준을 유지합니다. '.repeat(15)}\n---\n\n# rewritten`;

    const result = evaluateUpdate({
      path: skill.path,
      before: skill.content,
      after,
      blueprint: generated.blueprint,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('변경 비율');
  });

  it('rejects agent tools outside permission mode', () => {
    const before = `---\nname: ui-designer\ndescription: designer role description\npermissionMode: plan\ntools:\n  - Read\n  - Grep\n---\n\n# Role\n...`;
    const after = `---\nname: ui-designer\ndescription: designer role description\npermissionMode: plan\ntools:\n  - Read\n  - Bash\n---\n\n# Role\n...`;

    const generated = createGeneratedPackage(baseInput);

    const result = evaluateUpdate({
      path: 'agents/ui-designer.md',
      before,
      after,
      blueprint: generated.blueprint,
    });

    expect(result.ok).toBe(false);
  });
});
